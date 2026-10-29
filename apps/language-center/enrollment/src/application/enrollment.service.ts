import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import { EnrollmentPrismaService } from '../infrastructure/persistence/enrollment-prisma.service.js';
import { EnrollmentStatus, ProficiencyExamStatus } from '../infrastructure/persistence/generated/client.js';

const TEXT = /^[^<>]{1,80}$/u;
const LONG = /^[^<>]{1,240}$/u;
const MEET = /^[^<>]{0,255}$/u;
const CODE = /^[GSgs]\d{1,3}$/u;
const OCCUPYING: EnrollmentStatus[] = [EnrollmentStatus.PENDING_PAYMENT, EnrollmentStatus.ACTIVE];

const statusLabel: Record<EnrollmentStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  ACTIVE: 'Activo',
  APPROVED: 'Aprobado',
  FAILED: 'Desaprobado',
  WITHDRAWN: 'Retirado',
};

export type EnrollmentDraft = {
  readonly studentUserId: string;
  readonly groupId: string;
  readonly groupCode: string;
  readonly language: string;
  readonly level: string;
  readonly modality: string;
  readonly studyType: string;
  readonly schedule: string;
  readonly teacherName: string;
  readonly meetUrl: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly paymentId: string;
  readonly maxStudents: number;
};

export type WaitDraft = {
  readonly studentUserId: string;
  readonly groupId: string;
  readonly groupCode: string;
  readonly language: string;
  readonly schedule: string;
};

export type ExamDraft = {
  readonly studentUserId: string;
  readonly language: string;
  readonly examGroupId: string | null;
  readonly examDate: string | null;
  readonly modality: string;
  readonly meetUrl: string;
  readonly paymentId: string;
};

const presentEnrollment = (row: {
  id: string;
  groupId: string;
  groupCode: string;
  language: string;
  level: string;
  modality: string;
  studyType: string;
  schedule: string;
  teacherName: string;
  meetUrl: string;
  startsAt: Date;
  endsAt: Date;
  status: EnrollmentStatus;
  paymentId: string | null;
  enrolledAt: Date;
}) => ({
  id: row.id,
  groupId: row.groupId,
  groupCode: row.groupCode,
  language: row.language,
  level: row.level,
  modality: row.modality,
  studyType: row.studyType,
  schedule: row.schedule,
  teacherName: row.teacherName,
  meetUrl: row.meetUrl,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  status: row.status,
  statusLabel: statusLabel[row.status],
  paymentId: row.paymentId,
  enrolledAt: row.enrolledAt.toISOString(),
});

@Injectable()
export class EnrollmentService {
  constructor(private readonly db: EnrollmentPrismaService) {}

  async list(studentUserId: string) {
    const rows = await this.db.enrollment.findMany({
      where: { studentUserId },
      orderBy: [{ enrolledAt: 'desc' }],
    });
    return { enrollments: rows.map(presentEnrollment) };
  }

  async listGroup(groupId: string) {
    const rows = await this.db.enrollment.findMany({
      where: { groupId, status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.APPROVED] } },
      orderBy: { enrolledAt: 'asc' },
    });
    return { enrollments: rows.map((row) => ({ studentUserId: row.studentUserId, ...presentEnrollment(row) })) };
  }

  async counts() {
    const rows = await this.db.enrollment.groupBy({
      by: ['groupId'],
      where: { status: { in: OCCUPYING } },
      _count: { _all: true },
    });
    return { counts: rows.map((row) => ({ groupId: row.groupId, enrolled: row._count._all })) };
  }

  async enroll(draft: EnrollmentDraft) {
    this.checkedGroup(draft);
    if (!Number.isInteger(draft.maxStudents) || draft.maxStudents < 1 || draft.maxStudents > 500) {
      throw new BadRequestException('La capacidad del grupo no es válida.');
    }
    const occupying = await this.db.enrollment.count({ where: { groupId: draft.groupId, status: { in: OCCUPYING } } });
    if (occupying >= draft.maxStudents) throw new ConflictException('Ese grupo ya está lleno.');
    const duplicate = await this.db.enrollment.findUnique({
      where: { studentUserId_groupId: { studentUserId: draft.studentUserId, groupId: draft.groupId } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Ya estás matriculado en ese grupo.');
    try {
      const created = await this.db.enrollment.create({
        data: {
          studentUserId: draft.studentUserId,
          groupId: draft.groupId,
          groupCode: draft.groupCode.trim().toUpperCase(),
          language: draft.language.trim(),
          level: draft.level.trim(),
          modality: draft.modality.trim(),
          studyType: draft.studyType.trim(),
          schedule: draft.schedule.trim(),
          teacherName: draft.teacherName.trim(),
          meetUrl: draft.meetUrl.trim(),
          startsAt: new Date(draft.startsAt),
          endsAt: new Date(draft.endsAt),
          paymentId: draft.paymentId,
          status: EnrollmentStatus.PENDING_PAYMENT,
        },
      });
      return presentEnrollment(created);
    } catch {
      throw new ConflictException('Ya estás matriculado en ese grupo.');
    }
  }

  async wait(draft: WaitDraft) {
    if (!CODE.test(draft.groupCode) || !TEXT.test(draft.language) || !LONG.test(draft.schedule)) {
      throw new BadRequestException('Revisa la solicitud de grupo.');
    }
    try {
      const created = await this.db.groupWaitRequest.create({
        data: {
          studentUserId: draft.studentUserId,
          groupId: draft.groupId,
          groupCode: draft.groupCode.trim().toUpperCase(),
          language: draft.language.trim(),
          schedule: draft.schedule.trim(),
        },
        select: { id: true, groupCode: true, schedule: true },
      });
      return created;
    } catch {
      throw new ConflictException('Ya enviaste una solicitud para ese horario.');
    }
  }

  async listExams(studentUserId: string) {
    const rows = await this.db.proficiencyExamRegistration.findMany({
      where: { studentUserId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return {
      exams: rows.map((row) => ({
        id: row.id,
        language: row.language,
        examDate: row.examDate?.toISOString() ?? null,
        modality: row.modality,
        meetUrl: row.meetUrl,
        status: row.status,
        paymentId: row.paymentId,
      })),
    };
  }

  async registerExam(draft: ExamDraft) {
    if (!TEXT.test(draft.language) || !TEXT.test(draft.modality) || !MEET.test(draft.meetUrl)) {
      throw new BadRequestException('Revisa el registro del examen.');
    }
    const examDate = draft.examDate ? new Date(draft.examDate) : null;
    if (draft.examDate && (!examDate || Number.isNaN(examDate.getTime()))) throw new BadRequestException('La fecha del examen no es válida.');
    const created = await this.db.proficiencyExamRegistration.create({
      data: {
        studentUserId: draft.studentUserId,
        language: draft.language.trim(),
        examGroupId: draft.examGroupId,
        examDate,
        modality: draft.modality.trim(),
        meetUrl: draft.meetUrl.trim(),
        paymentId: draft.paymentId,
        status: ProficiencyExamStatus.PENDING_PAYMENT,
      },
    });
    return {
      id: created.id,
      language: created.language,
      examDate: created.examDate?.toISOString() ?? null,
      modality: created.modality,
      meetUrl: created.meetUrl,
      status: created.status,
      paymentId: created.paymentId,
    };
  }

  private checkedGroup(draft: EnrollmentDraft) {
    if (!CODE.test(draft.groupCode) || !TEXT.test(draft.language) || !TEXT.test(draft.level) || !TEXT.test(draft.modality) || !TEXT.test(draft.studyType)) {
      throw new BadRequestException('Revisa los datos del grupo.');
    }
    if (!LONG.test(draft.schedule) || !/^[^<>]{1,200}$/u.test(draft.teacherName) || !MEET.test(draft.meetUrl)) {
      throw new BadRequestException('Revisa el horario o el docente.');
    }
    const start = new Date(draft.startsAt);
    const end = new Date(draft.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('Las fechas del grupo no son válidas.');
    }
  }
}
