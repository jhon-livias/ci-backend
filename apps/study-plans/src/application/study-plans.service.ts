import { createHash } from 'node:crypto';

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { decodePdf, isCreditValue, visibleCurriculum } from '../domain/study-plan-rules.js';
import { StudyPlansPrismaService } from '../infrastructure/persistence/study-plans-prisma.service.js';
import type { StudyPlansActor } from '../interfaces/http/study-plans-session.js';

const creditsOf = (value: { toString(): string }): number => Number(value.toString());

@Injectable()
export class StudyPlansService {
  constructor(private readonly db: StudyPlansPrismaService) {}

  async catalog(actor: StudyPlansActor) {
    if (actor.scopes.length === 0) return { modalities: [], areas: [], careers: [] };
    const careers = await this.db.career.findMany({
      where: { enabled: true, code: { in: [...actor.scopes] }, area: { enabled: true } },
      orderBy: { name: 'asc' },
      include: { area: true },
    });
    const modalities = await this.db.modality.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } });
    const areas = [...new Map(careers.map((career) => [career.area.id, { id: career.area.id, code: career.area.code, name: career.area.name }])).values()];
    return {
      modalities: modalities.map((item) => ({ id: item.id, code: item.code, name: item.name })),
      areas,
      careers: careers.map((career) => ({ id: career.id, code: career.code, name: career.name, areaId: career.areaId })),
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
      cycles: row.cycles.map((cycle) => ({
        id: cycle.id,
        number: cycle.number,
        courses: cycle.courses.map((course) => ({
          id: course.id,
          position: course.position,
          code: course.code,
          name: course.name,
          credits: creditsOf(course.credits),
          syllabus: course.syllabi.length > 0 ? 'PUBLISHED' as const : 'PENDING' as const,
        })),
      })),
    };
  }

  async createCurriculum(actor: StudyPlansActor, input: { careerId: string; modalityId: string; year: string }) {
    this.faculty(actor);
    await this.ownedCareer(actor, input.careerId);
    const modality = await this.db.modality.findFirst({ where: { id: input.modalityId, enabled: true }, select: { id: true } });
    if (!modality) throw new BadRequestException('La modalidad no existe.');
    try {
      const created = await this.db.curriculum.create({
        data: { careerId: input.careerId, modalityId: input.modalityId, year: input.year, status: 'INACTIVE' },
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
        await tx.curriculum.updateMany({
          where: { careerId: current.careerId, modalityId: current.modalityId, status: 'ACTIVE', id: { not: id } },
          data: { status: 'INACTIVE' },
        });
      }
      await tx.curriculum.update({ where: { id }, data: { status } });
    });
    return { id, status };
  }

  async addCycle(actor: StudyPlansActor, curriculumId: string, number: number) {
    this.faculty(actor);
    await this.curriculum(actor, curriculumId);
    try {
      const created = await this.db.cycle.create({ data: { curriculumId, number } });
      return { id: created.id, number: created.number };
    } catch (error) {
      this.rethrowConflict(error, 'Ese ciclo ya existe en el plan.');
    }
  }

  async removeCycle(actor: StudyPlansActor, cycleId: string) {
    this.faculty(actor);
    const cycle = await this.db.cycle.findUnique({ where: { id: cycleId }, include: { curriculum: { include: { career: true } }, courses: { select: { id: true } } } });
    if (!cycle || !actor.scopes.includes(cycle.curriculum.career.code)) throw new NotFoundException();
    if (cycle.courses.length > 0) throw new BadRequestException('Quita los cursos antes de eliminar el ciclo.');
    await this.db.cycle.delete({ where: { id: cycleId } });
  }

  async addCourse(actor: StudyPlansActor, cycleId: string, input: { position: number; code: string; name: string; credits: number }) {
    this.faculty(actor);
    const cycle = await this.ownedCycle(actor, cycleId);
    this.credits(input.credits);
    await this.assertCourseCode(cycle.curriculumId, input.code);
    try {
      const created = await this.db.course.create({
        data: { cycleId, position: input.position, code: input.code, name: input.name.trim(), credits: input.credits.toFixed(1) },
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
      await this.db.course.update({
        where: { id: courseId },
        data: { position: input.position, code: input.code, name: input.name.trim(), credits: input.credits.toFixed(1) },
      });
    } catch (error) {
      this.rethrowConflict(error, 'Ese orden ya está ocupado en el ciclo.');
    }
  }

  async removeCourse(actor: StudyPlansActor, courseId: string) {
    this.faculty(actor);
    await this.ownedCourse(actor, courseId);
    await this.db.course.delete({ where: { id: courseId } });
  }

  async uploadSyllabus(actor: StudyPlansActor, courseId: string, contentBase64: string) {
    this.faculty(actor);
    const course = await this.ownedCourse(actor, courseId);
    const bytes = decodePdf(contentBase64);
    if (!bytes) throw new BadRequestException('El archivo debe ser un PDF de hasta 8 MB.');
    const latest = await this.db.syllabus.findFirst({ where: { courseId }, orderBy: { version: 'desc' }, select: { version: true } });
    await this.db.$transaction(async (tx) => {
      await tx.syllabus.updateMany({ where: { courseId, status: 'PUBLISHED' }, data: { status: 'RETIRED' } });
      await tx.syllabus.create({
        data: {
          courseId,
          version: (latest?.version ?? 0) + 1,
          status: 'PUBLISHED',
          content: Uint8Array.from(bytes),
          sha256: createHash('sha256').update(bytes).digest('hex'),
          sizeBytes: bytes.length,
          uploadedBy: actor.id,
        },
      });
    });
    return { courseId, code: course.code };
  }

  async retireSyllabus(actor: StudyPlansActor, courseId: string) {
    this.faculty(actor);
    await this.ownedCourse(actor, courseId);
    await this.db.syllabus.updateMany({ where: { courseId, status: 'PUBLISHED' }, data: { status: 'RETIRED' } });
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
