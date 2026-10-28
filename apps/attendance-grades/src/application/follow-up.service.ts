import { Injectable } from '@nestjs/common';

import { ATTENDANCE_ABSENCE_LIMIT, type AcademicFollowUp } from '../../../../libs/contracts/src/academic-follow-up.js';
import { AttendancePrismaService } from '../infrastructure/persistence/attendance-prisma.service.js';
import { StudentAttendanceStatus } from '../infrastructure/persistence/generated/client.js';

/** Consultation snapshot. Rows appear when teachers record attendance on opened groups. */
@Injectable()
export class FollowUpService {
  constructor(private readonly db: AttendancePrismaService) {}

  async read(): Promise<AcademicFollowUp> {
    const [rows, sessions] = await Promise.all([this.db.studentAttendance.findMany({ orderBy: [{ sessionDate: 'desc' }] }), this.db.teacherSession.findMany({ orderBy: [{ sessionDate: 'desc' }] })]);
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.groupId}:${row.studentUserId}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    const students = [...grouped.entries()].map(([id, marks]) => {
      const first = marks[0];
      const absences = marks.filter((mark) => mark.status === StudentAttendanceStatus.ABSENT || mark.status === StudentAttendanceStatus.JUSTIFIED_ABSENCE).length;
      return {
        id, code: first.studentCode, documentNumber: first.documentNumber, studentName: first.studentName,
        language: first.language, level: first.level, groupCode: first.groupCode,
        groupStatus: 'APERTURADO' as const, absencePercent: marks.length ? Math.round((absences / marks.length) * 100) : 0,
      };
    });
    const absences = rows.filter((row) => row.status === StudentAttendanceStatus.ABSENT || row.status === StudentAttendanceStatus.JUSTIFIED_ABSENCE).map((row) => ({
      id: row.id, occurredOn: row.sessionDate.toISOString().slice(0, 10), documentNumber: row.documentNumber,
      studentName: row.studentName, groupCode: row.groupCode, language: row.language, level: row.level,
      status: row.status === StudentAttendanceStatus.JUSTIFIED_ABSENCE ? 'Justificado' as const : 'Injustificado' as const,
    }));
    return {
      absenceLimit: ATTENDANCE_ABSENCE_LIMIT,
      alerts: students.filter((row) => row.absencePercent >= ATTENDANCE_ABSENCE_LIMIT).map((row) => ({ studentName: row.studentName, groupLabel: `${row.groupCode} · ${row.language} ${row.level}`, absencePercent: row.absencePercent })),
      students,
      teachers: [...new Map(sessions.map((session) => [`${session.groupId}:${session.teacherUserId}`, session])).values()].map((session) => {
        const marks = sessions.filter((item) => item.groupId === session.groupId && item.teacherUserId === session.teacherUserId);
        const attended = marks.filter((item) => item.checkInAt !== null).length;
        return { id: `${session.groupId}:${session.teacherUserId}`, documentNumber: session.teacherDocument || '—', teacherName: session.teacherName || 'Docente', language: session.language, level: session.level, groupCode: session.groupCode, groupStatus: 'APERTURADO' as const, attendancePercent: marks.length ? Math.round(attended * 100 / marks.length) : 0 };
      }),
      absences,
    };
  }
}
