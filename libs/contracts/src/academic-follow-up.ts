export const ATTENDANCE_ABSENCE_LIMIT = 30;

export type AttendanceMark = 'A' | 'T' | 'F' | 'FJ';
export type GroupStatus = 'APERTURADO' | 'CULMINADO';
export type AbsenceStatus = 'Injustificado' | 'Justificado';

export type StudentAttendanceAlert = {
  readonly studentName: string;
  readonly groupLabel: string;
  readonly absencePercent: number;
};

export type StudentAttendanceRow = {
  readonly id: string;
  readonly code: string;
  readonly documentNumber: string;
  readonly studentName: string;
  readonly language: string;
  readonly level: string;
  readonly groupCode: string;
  readonly groupStatus: GroupStatus;
  readonly absencePercent: number;
};

export type TeacherAttendanceRow = {
  readonly id: string;
  readonly documentNumber: string;
  readonly teacherName: string;
  readonly language: string;
  readonly level: string;
  readonly groupCode: string;
  readonly groupStatus: GroupStatus;
  readonly attendancePercent: number;
};

export type StudentAbsenceRow = {
  readonly id: string;
  readonly occurredOn: string;
  readonly documentNumber: string;
  readonly studentName: string;
  readonly groupCode: string;
  readonly language: string;
  readonly level: string;
  readonly status: AbsenceStatus;
};

export type AcademicFollowUp = {
  readonly absenceLimit: number;
  readonly alerts: readonly StudentAttendanceAlert[];
  readonly students: readonly StudentAttendanceRow[];
  readonly teachers: readonly TeacherAttendanceRow[];
  readonly absences: readonly StudentAbsenceRow[];
};

export const emptyAcademicFollowUp = (): AcademicFollowUp => ({
  absenceLimit: ATTENDANCE_ABSENCE_LIMIT,
  alerts: [],
  students: [],
  teachers: [],
  absences: [],
});
