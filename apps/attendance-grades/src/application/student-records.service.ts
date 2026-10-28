import { BadRequestException, Injectable } from '@nestjs/common';

import { limaCalendar } from '../../../../libs/contracts/src/lima-calendar.js';
import { AttendancePrismaService } from '../infrastructure/persistence/attendance-prisma.service.js';
import { StudentAttendanceStatus } from '../infrastructure/persistence/generated/client.js';

export type RecordGroup = {
  readonly id: string; readonly code: string; readonly language: string; readonly level: string;
  readonly status: string; readonly startsAt: string; readonly endsAt: string; readonly teacherUserId: string;
};
export type RecordStudent = {
  readonly userId: string; readonly code: string; readonly documentNumber: string; readonly name: string;
};
export type AttendanceInput = { readonly studentUserId: string; readonly status: StudentAttendanceStatus };
export type GradeInput = {
  readonly studentUserId: string; readonly listeningReading: number | null; readonly writing: number | null;
  readonly testOne: number | null; readonly participation: number | null; readonly finalTest: number | null;
};

const safe = (value: string, max: number) => /^[^<>]+$/u.test(value) && value.length <= max;
const dateOnly = (value: string) => value.slice(0, 10);
const decimal = (value: number | null): number | null => value === null ? null : Math.round(value * 100) / 100;
const score = (value: number | null) => value === null || (Number.isFinite(value) && value >= 0 && value <= 20);

@Injectable()
export class StudentRecordsService {
  constructor(private readonly db: AttendancePrismaService) {}

  async roster(group: RecordGroup, teacherUserId: string, students: readonly RecordStudent[]) {
    this.assertTeacher(group, teacherUserId);
    const saved = await this.db.studentAttendance.findMany({
      where: { groupId: group.id, sessionDate: new Date(`${limaCalendar().date}T00:00:00.000Z`) },
    });
    return {
      date: limaCalendar().date,
      students: students.map((student) => ({
        ...student,
        status: saved.find((item) => item.studentUserId === student.userId)?.status ?? null,
      })),
    };
  }

  async attendanceHistory(group: RecordGroup, teacherUserId: string) {
    this.assertTeacher(group, teacherUserId);
    const rows = await this.db.studentAttendance.findMany({ where: { groupId: group.id }, orderBy: [{ sessionDate: 'asc' }, { studentName: 'asc' }] });
    return { rows: rows.map((row) => ({ date: row.sessionDate.toISOString().slice(0, 10), documentNumber: row.documentNumber, studentName: row.studentName, status: row.status })) };
  }

  async saveAttendance(group: RecordGroup, teacherUserId: string, students: readonly RecordStudent[], rows: readonly AttendanceInput[]) {
    this.assertTeacher(group, teacherUserId);
    if (group.status !== 'OPENED') throw new BadRequestException('Solo se registra asistencia en grupos aperturados.');
    const today = limaCalendar().date;
    if (today < dateOnly(group.startsAt) || today > dateOnly(group.endsAt)) throw new BadRequestException('La fecha no corresponde al grupo.');
    if (rows.length !== students.length || new Set(rows.map((row) => row.studentUserId)).size !== students.length) throw new BadRequestException('Registra el estado de todos los alumnos.');
    const byId = new Map(students.map((student) => [student.userId, student]));
    await this.db.$transaction(rows.map((row) => {
      const student = byId.get(row.studentUserId);
      if (!student || !Object.values(StudentAttendanceStatus).includes(row.status)) throw new BadRequestException('La lista de asistencia no es válida.');
      return this.db.studentAttendance.upsert({
        where: { groupId_studentUserId_sessionDate: { groupId: group.id, studentUserId: student.userId, sessionDate: new Date(`${today}T00:00:00.000Z`) } },
        create: { groupId: group.id, studentUserId: student.userId, groupCode: group.code, language: group.language, level: group.level, studentCode: student.code, documentNumber: student.documentNumber, studentName: student.name, sessionDate: new Date(`${today}T00:00:00.000Z`), status: row.status, recordedByUserId: teacherUserId },
        update: { status: row.status, justificationNote: row.status === 'JUSTIFIED_ABSENCE' ? 'Justificada al registrar asistencia.' : null, justifiedAt: row.status === 'JUSTIFIED_ABSENCE' ? new Date() : null, recordedByUserId: teacherUserId },
      });
    }));
    return { date: today };
  }

  async grades(group: RecordGroup, teacherUserId: string, students: readonly RecordStudent[]) {
    this.assertTeacher(group, teacherUserId);
    const rows = await this.db.studentGrade.findMany({ where: { groupId: group.id } });
    return { students: students.map((student) => {
      const grade = rows.find((item) => item.studentUserId === student.userId);
      const values = grade ? [grade.listeningReading, grade.writing, grade.testOne, grade.participation, grade.finalTest].map((item) => item === null ? null : Number(item)) : [null, null, null, null, null];
      const total = values.every((item) => item !== null) ? values.reduce<number>((sum, item) => sum + (item ?? 0), 0) : null;
      return { ...student, listeningReading: values[0], writing: values[1], testOne: values[2], participation: values[3], finalTest: values[4], total };
    }) };
  }

  async saveGrades(group: RecordGroup, teacherUserId: string, students: readonly RecordStudent[], rows: readonly GradeInput[]) {
    this.assertGradeWindow(group, teacherUserId);
    const byId = new Map(students.map((student) => [student.userId, student]));
    if (rows.length !== students.length || new Set(rows.map((row) => row.studentUserId)).size !== students.length) throw new BadRequestException('Registra las notas de todos los alumnos.');
    await this.db.$transaction(rows.map((row) => {
      const student = byId.get(row.studentUserId);
      const values = [row.listeningReading, row.writing, row.testOne, row.participation, row.finalTest];
      if (!student || !values.every(score)) throw new BadRequestException('Cada nota debe estar entre 0 y 20.');
      return this.db.studentGrade.upsert({
        where: { groupId_studentUserId: { groupId: group.id, studentUserId: student.userId } },
        create: { groupId: group.id, studentUserId: student.userId, groupCode: group.code, language: group.language, level: group.level, studentCode: student.code, documentNumber: student.documentNumber, studentName: student.name, listeningReading: decimal(row.listeningReading), writing: decimal(row.writing), testOne: decimal(row.testOne), participation: decimal(row.participation), finalTest: decimal(row.finalTest), recordedByUserId: teacherUserId },
        update: { listeningReading: decimal(row.listeningReading), writing: decimal(row.writing), testOne: decimal(row.testOne), participation: decimal(row.participation), finalTest: decimal(row.finalTest), recordedByUserId: teacherUserId },
      });
    }));
  }

  private assertTeacher(group: RecordGroup, teacherUserId: string) {
    if (group.teacherUserId !== teacherUserId || !safe(group.code, 16) || !safe(group.language, 80) || !safe(group.level, 80)) throw new BadRequestException('El grupo no es válido.');
  }
  private assertGradeWindow(group: RecordGroup, teacherUserId: string) {
    this.assertTeacher(group, teacherUserId);
    if (group.status === 'OPENED') return;
    if (group.status !== 'COMPLETED') throw new BadRequestException('Las notas solo se editan en grupos aperturados o recién culminados.');
    const deadline = new Date(`${dateOnly(group.endsAt)}T00:00:00.000Z`); deadline.setUTCDate(deadline.getUTCDate() + 14);
    if (limaCalendar().date > deadline.toISOString().slice(0, 10)) throw new BadRequestException('El plazo de dos semanas para cerrar notas terminó.');
  }
}
