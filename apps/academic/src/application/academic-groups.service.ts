import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { CLASS_KIND_LABEL, formatRange } from '../../../../libs/contracts/src/schedule-combo.js';
import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';
import { AcademicGroupKind, AcademicGroupStatus } from '../infrastructure/persistence/generated/client.js';

const CODE_CLASSES = /^G\d{1,3}$/u;
const CODE_PROFICIENCY = /^S\d{1,3}$/u;
const TEXT = /^[^<>]{1,80}$/u;
const MEET = /^(https:\/\/[^\s<>]{1,240})?$/u;

export type GroupDraft = {
  readonly code: string;
  readonly kind: 'CLASSES' | 'PROFICIENCY';
  readonly language: string;
  readonly level: string;
  readonly modality: string;
  readonly studyType: string;
  readonly meetUrl: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly teacherUserId: string;
  readonly teacherDocument: string;
  readonly teacherName: string;
  readonly dayComboId: string | null;
  readonly hourComboId: string | null;
};

const statusLabel: Record<AcademicGroupStatus, string> = {
  CREATED: 'Creado',
  RESCHEDULED: 'Reprogramado',
  OPENED: 'Aperturado',
  COMPLETED: 'Culminado',
};

const kindLabel: Record<AcademicGroupKind, string> = {
  CLASSES: 'Clases',
  PROFICIENCY: 'Suficiencia',
};

const present = (group: {
  id: string;
  code: string;
  kind: AcademicGroupKind;
  status: AcademicGroupStatus;
  language: string;
  level: string;
  modality: string;
  studyType: string;
  meetUrl: string;
  startsAt: Date;
  endsAt: Date;
  teacherUserId: string;
  teacherDocument: string;
  teacherName: string;
  dayComboId: string | null;
  hourComboId: string | null;
  dayCombo: { slots: readonly { day: string; classKind: 'SYNCHRONOUS' | 'ASYNCHRONOUS'; startMinutes: number; endMinutes: number }[] } | null;
  hourCombo: { slots: readonly { day: string; startMinutes: number; endMinutes: number }[] } | null;
}) => {
  const days = group.dayCombo?.slots.map((slot) => slot.day).join(' - ') ?? '';
  const hours = group.hourCombo?.slots[0] ? formatRange(group.hourCombo.slots[0].startMinutes, group.hourCombo.slots[0].endMinutes) : '';
  const slots = (group.dayCombo?.slots ?? []).map((slot) => {
    const hour = group.hourCombo?.slots.find((item) => item.day === slot.day) ?? group.hourCombo?.slots[0];
    return {
      day: slot.day,
      classKind: slot.classKind,
      startMinutes: hour?.startMinutes ?? slot.startMinutes,
      endMinutes: hour?.endMinutes ?? slot.endMinutes,
    };
  });
  return {
    id: group.id,
    code: group.code,
    kind: group.kind,
    kindLabel: kindLabel[group.kind],
    status: group.status,
    statusLabel: statusLabel[group.status],
    language: group.language,
    level: group.level,
    modality: group.modality,
    studyType: group.studyType,
    meetUrl: group.meetUrl,
    startsAt: group.startsAt.toISOString(),
    endsAt: group.endsAt.toISOString(),
    teacherUserId: group.teacherUserId,
    teacherDocument: group.teacherDocument,
    teacherName: group.teacherName,
    dayComboId: group.dayComboId,
    hourComboId: group.hourComboId,
    schedule: days && hours ? `${days} | ${hours}` : days || hours || '—',
    enrolledCount: 0,
    classTypes: group.dayCombo?.slots.map((slot) => CLASS_KIND_LABEL[slot.classKind]).join(', ') ?? '',
    slots,
  };
};

const include = { dayCombo: { include: { slots: true } }, hourCombo: { include: { slots: true } } } as const;

@Injectable()
export class AcademicGroupsService {
  constructor(private readonly db: AcademicPrismaService) {}

  async list() {
    const groups = await this.db.academicGroup.findMany({ include, orderBy: [{ createdAt: 'desc' }] });
    return { groups: groups.map(present) };
  }

  async listForTeacher(teacherUserId: string) {
    const groups = await this.db.academicGroup.findMany({
      where: { teacherUserId },
      include,
      orderBy: [{ createdAt: 'desc' }],
    });
    return { groups: groups.map(present) };
  }

  async listOfferings(language?: string) {
    const groups = await this.db.academicGroup.findMany({
      where: {
        kind: AcademicGroupKind.CLASSES,
        status: { in: [AcademicGroupStatus.CREATED, AcademicGroupStatus.RESCHEDULED, AcademicGroupStatus.OPENED] },
        ...(language ? { language } : {}),
      },
      include,
      orderBy: [{ startsAt: 'asc' }],
    });
    return { groups: groups.map(present) };
  }

  async listProficiency(language?: string) {
    const groups = await this.db.academicGroup.findMany({
      where: {
        kind: AcademicGroupKind.PROFICIENCY,
        status: { in: [AcademicGroupStatus.CREATED, AcademicGroupStatus.RESCHEDULED, AcademicGroupStatus.OPENED] },
        ...(language ? { language } : {}),
      },
      include,
      orderBy: [{ startsAt: 'asc' }],
    });
    return { groups: groups.map(present) };
  }

  async create(draft: GroupDraft) {
    const data = this.checked(draft, true);
    await this.ensureCode(data.code);
    try {
      const created = await this.db.academicGroup.create({ data, include });
      return present(created);
    } catch {
      throw new ConflictException('Ese código de grupo ya existe.');
    }
  }

  async update(id: string, draft: GroupDraft) {
    const current = await this.db.academicGroup.findUnique({ where: { id }, select: { id: true, status: true, code: true } });
    if (!current) throw new NotFoundException();
    if (current.status === AcademicGroupStatus.OPENED || current.status === AcademicGroupStatus.COMPLETED) {
      throw new BadRequestException('Un grupo aperturado o culminado no se actualiza por esta vía.');
    }
    const data = this.checked(draft, false);
    if (data.code !== current.code) await this.ensureCode(data.code);
    const updated = await this.db.academicGroup.update({ where: { id }, data, include });
    return present(updated);
  }

  async reschedule(id: string, startsAt: string, endsAt: string) {
    const current = await this.db.academicGroup.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new NotFoundException();
    if (current.status === AcademicGroupStatus.OPENED || current.status === AcademicGroupStatus.COMPLETED) {
      throw new BadRequestException('Un grupo aperturado no se reprograma.');
    }
    const range = this.range(startsAt, endsAt);
    const updated = await this.db.academicGroup.update({
      where: { id },
      data: { ...range, status: AcademicGroupStatus.RESCHEDULED },
      include,
    });
    return present(updated);
  }

  private async ensureCode(code: string) {
    const exists = await this.db.academicGroup.findUnique({ where: { code }, select: { id: true } });
    if (exists) throw new ConflictException('Ese código de grupo ya existe.');
  }

  private checked(draft: GroupDraft, creating: boolean) {
    const kind = draft.kind === 'PROFICIENCY' ? AcademicGroupKind.PROFICIENCY : AcademicGroupKind.CLASSES;
    const code = draft.code.trim().toUpperCase();
    if (kind === AcademicGroupKind.CLASSES && !CODE_CLASSES.test(code)) throw new BadRequestException('El código de clases debe ser G seguido de números.');
    if (kind === AcademicGroupKind.PROFICIENCY && !CODE_PROFICIENCY.test(code)) throw new BadRequestException('El código de suficiencia debe ser S seguido de números.');
    if (!TEXT.test(draft.language) || !TEXT.test(draft.modality)) throw new BadRequestException('Revisa el idioma o la modalidad.');
    const level = kind === AcademicGroupKind.PROFICIENCY ? 'Ninguno' : draft.level.trim();
    const studyType = kind === AcademicGroupKind.PROFICIENCY ? 'Ninguno' : draft.studyType.trim();
    if (!TEXT.test(level) || !TEXT.test(studyType)) throw new BadRequestException('Revisa el nivel o el tipo de estudio.');
    const meetUrl = kind === AcademicGroupKind.PROFICIENCY ? '' : draft.meetUrl.trim();
    if (!MEET.test(meetUrl)) throw new BadRequestException('El enlace de la clase no es válido.');
    if (!/^\d{8}$/u.test(draft.teacherDocument) || !/^[^<>]{1,200}$/u.test(draft.teacherName)) {
      throw new BadRequestException('Revisa el docente.');
    }
    const dayComboId = kind === AcademicGroupKind.PROFICIENCY ? null : draft.dayComboId;
    const hourComboId = kind === AcademicGroupKind.PROFICIENCY ? null : draft.hourComboId;
    if (kind === AcademicGroupKind.CLASSES && (!dayComboId || !hourComboId)) {
      throw new BadRequestException('Selecciona los combos de días y horas.');
    }
    void creating;
    return {
      code,
      kind,
      language: draft.language.trim(),
      level,
      modality: draft.modality.trim(),
      studyType,
      meetUrl,
      teacherUserId: draft.teacherUserId,
      teacherDocument: draft.teacherDocument,
      teacherName: draft.teacherName.trim(),
      dayComboId,
      hourComboId,
      ...this.range(draft.startsAt, draft.endsAt),
    };
  }

  private range(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('La fecha final debe ser posterior a la de inicio.');
    }
    return { startsAt: start, endsAt: end };
  }
}
