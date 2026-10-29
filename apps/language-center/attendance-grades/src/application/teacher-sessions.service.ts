import { BadRequestException, Injectable } from '@nestjs/common';

import { CLASS_KIND_LABEL, formatRange, type ClassKindCode } from '../../../../../libs/contracts/src/schedule-combo.js';
import { limaCalendar } from '../../../../../libs/contracts/src/lima-calendar.js';
import { AttendancePrismaService } from '../infrastructure/persistence/attendance-prisma.service.js';
import { PrivateAttachmentStore } from '../infrastructure/storage/private-attachment.store.js';
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
  readonly teacherName: string;
  readonly teacherDocument: string;
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
  constructor(private readonly db: AttendancePrismaService, private readonly files: PrivateAttachmentStore) {}

  async absences(group: TeachingGroupSnapshot, teacherUserId: string) {
    this.assertOwner(group, teacherUserId);
    const rows = await this.db.teacherSession.findMany({ where: { groupId: group.id, teacherUserId, checkInAt: null }, orderBy: { sessionDate: 'desc' } });
    const recorded = await this.db.teacherAbsence.findMany({ where: { groupId: group.id, teacherUserId } });
    const justifications = await this.db.teacherJustification.findMany();
    const byAbsence = new Map(recorded.map((item) => [item.occurredOn.toISOString().slice(0, 10), item.id]));
    const byId = new Map(justifications.map((item) => [item.teacherAbsenceId, item]));
    return { absences: rows.map((row) => { const absenceId = byAbsence.get(row.sessionDate.toISOString().slice(0, 10)); const justification = absenceId ? byId.get(absenceId) : undefined; return { id: row.id, date: row.sessionDate.toISOString().slice(0, 10), groupCode: row.groupCode, language: row.language, level: row.level, status: justification ? 'Justificado' : 'Injustificado', attachmentName: justification?.fileName ?? null }; }) };
  }

  async allAbsences(filter: { query?: string; date?: string; status?: string }) {
    const rows = await this.db.teacherSession.findMany({ where: { checkInAt: null }, orderBy: { sessionDate: 'desc' } });
    const recorded = await this.db.teacherAbsence.findMany();
    const justifications = await this.db.teacherJustification.findMany();
    const absenceByKey = new Map(recorded.map((item) => [`${item.teacherUserId}:${item.groupId}:${item.occurredOn.toISOString().slice(0, 10)}`, item.id]));
    const justificationByAbsence = new Map(justifications.map((item) => [item.teacherAbsenceId, item]));
    const query = filter.query?.trim().toLowerCase() ?? '';
    return { absences: rows.flatMap((row) => {
      const absenceId = absenceByKey.get(`${row.teacherUserId}:${row.groupId}:${row.sessionDate.toISOString().slice(0, 10)}`);
      const justification = absenceId ? justificationByAbsence.get(absenceId) : undefined;
      const status = justification ? 'Justificado' : 'Injustificado';
      if ((query && !row.teacherDocument.includes(query) && !row.teacherName.toLowerCase().includes(query)) || (filter.date && row.sessionDate.toISOString().slice(0, 10) !== filter.date) || (filter.status && filter.status !== status)) return [];
      return [{ id: row.id, date: row.sessionDate.toISOString().slice(0, 10), documentNumber: row.teacherDocument, teacherName: row.teacherName, groupCode: row.groupCode, language: row.language, level: row.level, status, reason: justification?.reason ?? null, attachmentName: justification?.fileName ?? null, teacherAbsenceId: absenceId ?? null }];
    }) };
  }

  async attachment(teacherAbsenceId: string) {
    const justification = await this.db.teacherJustification.findUnique({ where: { teacherAbsenceId } });
    if (!justification) throw new BadRequestException('La justificación no tiene adjunto.');
    const data = await this.files.read(justification.objectKey).catch(() => { throw new BadRequestException('El adjunto no está disponible.'); });
    return { name: justification.fileName, contentType: justification.contentType, base64: data.toString('base64') };
  }

  async justifyAbsence(group: TeachingGroupSnapshot, teacherUserId: string, sessionId: string, reason: string, file?: { name: string; contentType: string; base64: string }) {
    this.assertOwner(group, teacherUserId);
    if (!/^[^<>]{1,500}$/u.test(reason.trim()) || !file) throw new BadRequestException('El motivo y el adjunto son obligatorios.');
    const session = await this.db.teacherSession.findUnique({ where: { id: sessionId } });
    if (!session || session.groupId !== group.id || session.teacherUserId !== teacherUserId || session.checkInAt) throw new BadRequestException('La falta no es válida para justificar.');
    const attachment = await this.files.save(file);
    const absence = await this.db.teacherAbsence.upsert({ where: { teacherUserId_groupId_occurredOn: { teacherUserId, groupId: group.id, occurredOn: session.sessionDate } }, create: { teacherUserId, groupId: group.id, groupCode: session.groupCode, language: session.language, level: session.level, occurredOn: session.sessionDate }, update: {} });
    await this.db.teacherJustification.upsert({ where: { teacherAbsenceId: absence.id }, create: { teacherAbsenceId: absence.id, reason: reason.trim(), objectKey: attachment.key, fileName: attachment.name, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes, createdBy: teacherUserId }, update: { reason: reason.trim(), objectKey: attachment.key, fileName: attachment.name, contentType: attachment.contentType, sizeBytes: attachment.sizeBytes, createdBy: teacherUserId } });
  }

  async list(groupId: string, teacherUserId: string) {
    const rows = await this.db.teacherSession.findMany({
      where: { groupId, teacherUserId },
      orderBy: { sessionDate: 'desc' },
    });
    return { sessions: rows.map(present) };
  }

  async synchronizePastSessions(group: TeachingGroupSnapshot, teacherUserId: string) {
    if (group.teacherUserId !== teacherUserId) throw new BadRequestException('Ese grupo no está asignado a este docente.');
    const today = limaCalendar().date;
    const end = [group.endsAt.slice(0, 10), today].sort()[0];
    for (let cursor = group.startsAt.slice(0, 10); cursor <= end; ) {
      const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(`${cursor}T00:00:00.000Z`).getUTCDay()];
      const slot = group.slots.find((item) => item.day === weekday);
      if (slot && cursor < today) await this.db.teacherSession.upsert({
        where: { groupId_teacherUserId_sessionDate: { groupId: group.id, teacherUserId, sessionDate: new Date(`${cursor}T00:00:00.000Z`) } },
        create: { groupId: group.id, teacherUserId, teacherName: group.teacherName, teacherDocument: group.teacherDocument, groupCode: group.code, language: group.language, level: group.level, sessionDate: new Date(`${cursor}T00:00:00.000Z`), classKind: slot.classKind === 'ASYNCHRONOUS' ? 'ASYNCHRONOUS' : 'SYNCHRONOUS', startMinutes: slot.startMinutes, endMinutes: slot.endMinutes }, update: {},
      });
      const next = new Date(`${cursor}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + 1); cursor = next.toISOString().slice(0, 10);
    }
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
        teacherName: group.teacherName,
        teacherDocument: group.teacherDocument,
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

  private assertOwner(group: TeachingGroupSnapshot, teacherUserId: string) {
    if (group.teacherUserId !== teacherUserId) throw new BadRequestException('Ese grupo no está asignado a este docente.');
  }
}
