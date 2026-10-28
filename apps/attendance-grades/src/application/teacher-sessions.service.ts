import { BadRequestException, Injectable } from '@nestjs/common';

import { CLASS_KIND_LABEL, formatRange, type ClassKindCode } from '../../../../libs/contracts/src/schedule-combo.js';
import { limaCalendar } from '../../../../libs/contracts/src/lima-calendar.js';
import { AttendancePrismaService } from '../infrastructure/persistence/attendance-prisma.service.js';
import { SessionClassKind } from '../infrastructure/persistence/generated/client.js';

export type TeachingSlot = {
  readonly day: string;
  readonly classKind: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
};

export type TeachingGroupSnapshot = {
  readonly id: string;
  readonly code: string;
  readonly language: string;
  readonly level: string;
  readonly status: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly teacherUserId: string;
  readonly slots: readonly TeachingSlot[];
};

const present = (row: {
  id: string;
  groupId: string;
  sessionDate: Date;
  classKind: SessionClassKind;
  startMinutes: number;
  endMinutes: number;
  checkInAt: Date | null;
  checkOutAt: Date | null;
}) => ({
  id: row.id,
  groupId: row.groupId,
  sessionDate: row.sessionDate.toISOString().slice(0, 10),
  classKind: row.classKind,
  classType: CLASS_KIND_LABEL[row.classKind],
  startMinutes: row.startMinutes,
  endMinutes: row.endMinutes,
  hours: formatRange(row.startMinutes, row.endMinutes),
  checkInAt: row.checkInAt?.toISOString() ?? null,
  checkOutAt: row.checkOutAt?.toISOString() ?? null,
});

@Injectable()
export class TeacherSessionsService {
  constructor(private readonly db: AttendancePrismaService) {}

  async list(groupId: string, teacherUserId: string) {
    const rows = await this.db.teacherSession.findMany({
      where: { groupId, teacherUserId },
      orderBy: { sessionDate: 'desc' },
    });
    return { sessions: rows.map(present) };
  }

  async checkIn(group: TeachingGroupSnapshot, teacherUserId: string) {
    const slot = this.todaySlot(group, teacherUserId);
    const sessionDate = new Date(`${slot.date}T00:00:00.000Z`);
    const current = await this.db.teacherSession.findUnique({
      where: { groupId_teacherUserId_sessionDate: { groupId: group.id, teacherUserId, sessionDate } },
    });
    if (current?.checkInAt) throw new BadRequestException('La entrada de hoy ya está registrada.');
    const saved = await this.db.teacherSession.upsert({
      where: { groupId_teacherUserId_sessionDate: { groupId: group.id, teacherUserId, sessionDate } },
      create: {
        groupId: group.id,
        teacherUserId,
        groupCode: group.code,
        language: group.language,
        level: group.level,
        sessionDate,
        classKind: slot.classKind,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        checkInAt: new Date(),
      },
      update: { checkInAt: new Date() },
    });
    return present(saved);
  }

  async checkOut(group: TeachingGroupSnapshot, teacherUserId: string) {
    const slot = this.todaySlot(group, teacherUserId);
    const sessionDate = new Date(`${slot.date}T00:00:00.000Z`);
    const current = await this.db.teacherSession.findUnique({
      where: { groupId_teacherUserId_sessionDate: { groupId: group.id, teacherUserId, sessionDate } },
    });
    if (!current?.checkInAt) throw new BadRequestException('Registra la entrada antes de la salida.');
    if (current.checkOutAt) throw new BadRequestException('La salida de hoy ya está registrada.');
    const saved = await this.db.teacherSession.update({
      where: { id: current.id },
      data: { checkOutAt: new Date() },
    });
    return present(saved);
  }

  private todaySlot(group: TeachingGroupSnapshot, teacherUserId: string) {
    if (group.teacherUserId !== teacherUserId) throw new BadRequestException('Ese grupo no está asignado a este docente.');
    if (group.status !== 'OPENED') throw new BadRequestException('Solo se marca asistencia en un grupo aperturado.');
    const today = limaCalendar();
    const start = group.startsAt.slice(0, 10);
    const end = group.endsAt.slice(0, 10);
    if (today.date < start || today.date > end) throw new BadRequestException('Hoy no corresponde a las fechas del grupo.');
    const slot = group.slots.find((item) => item.day === today.day);
    if (!slot) throw new BadRequestException('Hoy no hay una clase programada para este grupo.');
    const classKind: ClassKindCode = slot.classKind === 'ASYNCHRONOUS' ? 'ASYNCHRONOUS' : 'SYNCHRONOUS';
    return { ...slot, classKind, date: today.date };
  }
}
