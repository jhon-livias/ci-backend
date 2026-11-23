import { createHash } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { courseVisibleTo, decodePdf, isCreditValue, visibleCurriculum, type AuditAction } from '../domain/study-plan-rules.js';
import { StudyPlansPrismaService } from '../infrastructure/persistence/study-plans-prisma.service.js';
import type { StudyPlansActor } from '../interfaces/http/study-plans-session.js';
import { DeletionProof } from './deletion-proof.js';

const creditsOf = (value: { toString(): string }): number => Number(value.toString());

@Injectable()
export class StudyPlansService {
  constructor(
    private readonly db: StudyPlansPrismaService,
    private readonly deletion: DeletionProof,
  ) {}

  async catalog(actor: StudyPlansActor) {
    if (actor.scopes.length === 0) return { modalities: [], areas: [], careers: [], offerings: [] };
    const rows = await this.db.curriculum.findMany({
      where: {
        modality: { enabled: true },
        career: { enabled: true, code: { in: [...actor.scopes] }, area: { enabled: true } },
      },
      select: {
        modalityId: true,
        careerId: true,
        modality: { select: { id: true, code: true, name: true } },
        career: { select: { id: true, code: true, name: true, areaId: true, area: { select: { id: true, code: true, name: true } } } },
      },
    });
    const modalities = [...new Map(rows.map((row) => [row.modality.id, row.modality])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
    const careers = [...new Map(rows.map((row) => [row.career.id, row.career])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
    const areas = [...new Map(careers.map((career) => [career.area.id, career.area])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'es'));
    const offerings = [...new Map(rows.map((row) => [`${row.modalityId}:${row.careerId}`, { modalityId: row.modalityId, careerId: row.careerId }])).values()];
    return {
      modalities,
      areas,
      careers: careers.map((career) => ({ id: career.id, code: career.code, name: career.name, areaId: career.areaId })),
      offerings,
    };
  }

  async listCurricula(actor: StudyPlansActor, careerId: string, modalityId: string) {
    await this.ownedCareer(actor, careerId);
    const rows = await this.db.curriculum.findMany({
      where: { careerId, modalityId, ...(actor.role === 'teacher' ? { status: 'ACTIVE' as const } : {}) },
      orderBy: { year: 'desc' },
    });
    return rows.map((row) => ({ id: row.id, year: row.year, status: row.status }));
  }

  async curriculum(actor: StudyPlansActor, id: string) {
    const row = await this.db.curriculum.findUnique({
      where: { id },
      include: {
        career: true,
        modality: true,
        cycles: {
          orderBy: { number: 'asc' },
          include: {
            courses: {
              orderBy: { position: 'asc' },
              include: { syllabi: { where: { status: 'PUBLISHED' }, select: { id: true } } },
            },
          },
        },
      },
    });
    if (!row || !actor.scopes.includes(row.career.code) || !visibleCurriculum(actor.role, row.status)) {
      throw new NotFoundException();
    }
    return {
      id: row.id,
      year: row.year,
      status: row.status,
      career: { id: row.career.id, code: row.career.code, name: row.career.name },
      modality: { id: row.modality.id, code: row.modality.code, name: row.modality.name },
      cycles: row.cycles.flatMap((cycle) => {
        const courses = cycle.courses
          .filter((course) => courseVisibleTo(actor.role, course.syllabi.length > 0 ? 'PUBLISHED' : 'PENDING'))
          .map((course) => ({
            id: course.id,
            position: course.position,
            code: course.code,
            name: course.name,
            credits: creditsOf(course.credits),
            syllabus: course.syllabi.length > 0 ? 'PUBLISHED' as const : 'PENDING' as const,
          }));
        if (actor.role === 'teacher' && courses.length === 0) return [];
        return [{ id: cycle.id, number: cycle.number, courses }];
      }),
    };
  }

  async createCurriculum(actor: StudyPlansActor, input: { careerId: string; modalityId: string; year: string }) {
    this.faculty(actor);
    await this.ownedCareer(actor, input.careerId);
    const modality = await this.db.modality.findFirst({ where: { id: input.modalityId, enabled: true }, select: { id: true } });
    if (!modality) throw new BadRequestException('La modalidad no existe.');
    try {
      const created = await this.db.$transaction(async (tx) => {
        const row = await tx.curriculum.create({
          data: { careerId: input.careerId, modalityId: input.modalityId, year: input.year, status: 'INACTIVE' },
        });
        await tx.auditEvent.create({ data: this.auditData(actor, 'curriculum.created', 'curriculum', row.id) });
        return row;
      });
      return { id: created.id, year: created.year, status: created.status };
    } catch (error) {
      this.rethrowConflict(error, 'Ya existe un plan para esa carrera, modalidad y vigencia.');
    }
  }

  async setStatus(actor: StudyPlansActor, id: string, status: 'ACTIVE' | 'INACTIVE') {
    this.faculty(actor);
    const current = await this.db.curriculum.findUnique({ where: { id }, include: { career: true } });
    if (!current || !actor.scopes.includes(current.career.code)) throw new NotFoundException();
    await this.db.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        const others = await tx.curriculum.findMany({
          where: { careerId: current.careerId, modalityId: current.modalityId, status: 'ACTIVE', id: { not: id } },
          select: { id: true },
        });
        if (others.length > 0) {
          await tx.curriculum.updateMany({
            where: { id: { in: others.map((row) => row.id) } },
            data: { status: 'INACTIVE' },
          });
          for (const other of others) {
            await tx.auditEvent.create({ data: this.auditData(actor, 'curriculum.deactivated', 'curriculum', other.id) });
          }
        }
      }
      await tx.curriculum.update({ where: { id }, data: { status } });
      await tx.auditEvent.create({
        data: this.auditData(actor, status === 'ACTIVE' ? 'curriculum.activated' : 'curriculum.deactivated', 'curriculum', id),
      });
    });
    return { id, status };
  }

  async addCycle(actor: StudyPlansActor, curriculumId: string, number: number) {
    this.faculty(actor);
    await this.curriculum(actor, curriculumId);
    try {
      const created = await this.db.$transaction(async (tx) => {
        const row = await tx.cycle.create({ data: { curriculumId, number } });
        await tx.auditEvent.create({ data: this.auditData(actor, 'cycle.created', 'cycle', row.id) });
        return row;
      });
      return { id: created.id, number: created.number };
    } catch (error) {
      this.rethrowConflict(error, 'Ese ciclo ya existe en el plan.');
    }
  }

  async removeCycle(actor: StudyPlansActor, cycleId: string, totpCode: string | undefined) {
    this.faculty(actor);
    await this.deletion.assert(actor.id, totpCode);
    const cycle = await this.db.cycle.findUnique({ where: { id: cycleId }, include: { curriculum: { include: { career: true } }, courses: { select: { id: true } } } });
    if (!cycle || !actor.scopes.includes(cycle.curriculum.career.code)) throw new NotFoundException();
    if (cycle.courses.length > 0) throw new BadRequestException('Quita los cursos antes de eliminar el ciclo.');
    await this.db.$transaction(async (tx) => {
      await tx.cycle.delete({ where: { id: cycleId } });
      await tx.auditEvent.create({ data: this.auditData(actor, 'cycle.removed', 'cycle', cycleId) });
    });
  }

  async addCourse(actor: StudyPlansActor, cycleId: string, input: { position: number; code: string; name: string; credits: number }) {
    this.faculty(actor);
    const cycle = await this.ownedCycle(actor, cycleId);
    this.credits(input.credits);
    await this.assertCourseCode(cycle.curriculumId, input.code);
    try {
      const created = await this.db.$transaction(async (tx) => {
        const row = await tx.course.create({
          data: { cycleId, position: input.position, code: input.code, name: input.name.trim(), credits: input.credits.toFixed(1) },
        });
        await tx.auditEvent.create({ data: this.auditData(actor, 'course.created', 'course', row.id) });
        return row;
      });
      return { id: created.id };
    } catch (error) {
      this.rethrowConflict(error, 'Ese orden ya está ocupado en el ciclo.');
    }
  }

  async updateCourse(actor: StudyPlansActor, courseId: string, input: { position: number; code: string; name: string; credits: number }) {
    this.faculty(actor);
    const course = await this.ownedCourse(actor, courseId);
    this.credits(input.credits);
    await this.assertCourseCode(course.cycle.curriculumId, input.code, courseId);
    try {
      await this.db.$transaction(async (tx) => {
        await tx.course.update({
          where: { id: courseId },
          data: { position: input.position, code: input.code, name: input.name.trim(), credits: input.credits.toFixed(1) },
        });
        await tx.auditEvent.create({ data: this.auditData(actor, 'course.updated', 'course', courseId) });
      });
    } catch (error) {
      this.rethrowConflict(error, 'Ese orden ya está ocupado en el ciclo.');
    }
  }

  async removeCourse(actor: StudyPlansActor, courseId: string, totpCode: string | undefined) {
    this.faculty(actor);
    await this.deletion.assert(actor.id, totpCode);
    await this.ownedCourse(actor, courseId);
    await this.db.$transaction(async (tx) => {
      await tx.course.delete({ where: { id: courseId } });
      await tx.auditEvent.create({ data: this.auditData(actor, 'course.removed', 'course', courseId) });
    });
  }

  // El archivo se publica al validar la firma %PDF. Queda para una entrega posterior
  // el bucket privado, la cuarentena con análisis, la sesión recién emitida y la clave
  // de idempotencia que evita otra versión si el cliente reintenta.
  async uploadSyllabus(actor: StudyPlansActor, courseId: string, contentBase64: string) {
    this.faculty(actor);
    const course = await this.ownedCourse(actor, courseId);
    const bytes = decodePdf(contentBase64);
    if (!bytes) throw new BadRequestException('El archivo debe ser un PDF de hasta 8 MB.');
    await this.db.$transaction(async (tx) => {
      const previous = await tx.syllabus.findMany({ where: { courseId, status: 'PUBLISHED' }, select: { id: true } });
      const latest = await tx.syllabus.findFirst({ where: { courseId }, orderBy: { version: 'desc' }, select: { version: true } });
      if (previous.length > 0) {
        await tx.syllabus.updateMany({ where: { id: { in: previous.map((row) => row.id) } }, data: { status: 'RETIRED' } });
        for (const file of previous) {
          await tx.auditEvent.create({ data: this.auditData(actor, 'syllabus.retired', 'syllabus', file.id) });
        }
      }
      const created = await tx.syllabus.create({
        data: {
          courseId,
          version: (latest?.version ?? 0) + 1,
          status: 'PUBLISHED',
          content: Uint8Array.from(bytes),
          sha256: createHash('sha256').update(bytes).digest('hex'),
          sizeBytes: bytes.length,
          uploadedBy: actor.id,
        },
        select: { id: true },
      });
      await tx.auditEvent.create({ data: this.auditData(actor, 'syllabus.published', 'syllabus', created.id) });
    });
    return { courseId, code: course.code };
  }

  async retireSyllabus(actor: StudyPlansActor, courseId: string, totpCode: string | undefined) {
    this.faculty(actor);
    await this.deletion.assert(actor.id, totpCode);
    await this.ownedCourse(actor, courseId);
    const current = await this.db.syllabus.findMany({ where: { courseId, status: 'PUBLISHED' }, select: { id: true } });
    if (current.length === 0) return;
    await this.db.$transaction(async (tx) => {
      await tx.syllabus.updateMany({ where: { id: { in: current.map((row) => row.id) } }, data: { status: 'RETIRED' } });
      for (const file of current) {
        await tx.auditEvent.create({ data: this.auditData(actor, 'syllabus.retired', 'syllabus', file.id) });
      }
    });
  }

  async syllabusFile(actor: StudyPlansActor, courseId: string) {
    const course = await this.ownedCourse(actor, courseId);
    if (actor.role === 'teacher' && course.cycle.curriculum.status !== 'ACTIVE') throw new NotFoundException();
    const file = await this.db.syllabus.findFirst({
      where: { courseId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      select: { content: true, sizeBytes: true },
    });
    if (!file) throw new NotFoundException();
    return { code: course.code, content: file.content, sizeBytes: file.sizeBytes };
  }

  private faculty(actor: StudyPlansActor): void {
    if (actor.role !== 'faculty') throw new ForbiddenException('Solo facultad puede modificar el plan.');
  }

  private credits(value: number): void {
    if (!isCreditValue(value)) throw new BadRequestException('Los créditos van de 0.5 en 0.5.');
  }

  private auditData(actor: StudyPlansActor, action: AuditAction, entityType: 'curriculum' | 'cycle' | 'course' | 'syllabus', entityId: string) {
    return { actorId: actor.id, action, entityType, entityId, correlationId: actor.correlationId };
  }

  private async ownedCareer(actor: StudyPlansActor, careerId: string) {
    const career = await this.db.career.findUnique({ where: { id: careerId } });
    if (!career || !career.enabled || !actor.scopes.includes(career.code)) throw new ForbiddenException('Esta carrera está fuera de tu asignación.');
    return career;
  }

  private async ownedCycle(actor: StudyPlansActor, cycleId: string) {
    const cycle = await this.db.cycle.findUnique({ where: { id: cycleId }, include: { curriculum: { include: { career: true } } } });
    if (!cycle || !actor.scopes.includes(cycle.curriculum.career.code)) throw new NotFoundException();
    if (!visibleCurriculum(actor.role, cycle.curriculum.status)) throw new NotFoundException();
    return cycle;
  }

  private async ownedCourse(actor: StudyPlansActor, courseId: string) {
    const course = await this.db.course.findUnique({
      where: { id: courseId },
      include: { cycle: { include: { curriculum: { include: { career: true } } } } },
    });
    if (!course || !actor.scopes.includes(course.cycle.curriculum.career.code)) throw new NotFoundException();
    if (!visibleCurriculum(actor.role, course.cycle.curriculum.status)) throw new NotFoundException();
    return course;
  }

  private async assertCourseCode(curriculumId: string, code: string, exceptId?: string): Promise<void> {
    const clash = await this.db.course.findFirst({
      where: { code, cycle: { curriculumId }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Ya existe un curso con ese código en el plan.');
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}
