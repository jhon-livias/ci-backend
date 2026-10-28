import { describe, expect, it } from 'vitest';

import { StudentRecordsService } from './student-records.service.js';

const group = (overrides: Partial<{ status: string; endsAt: string; teacherUserId: string }> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001', code: 'G10', language: 'Inglés', level: 'Básico 1', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-31T00:00:00.000Z', teacherUserId: '00000000-0000-4000-8000-000000000002', status: 'OPENED', ...overrides,
});
const student = { userId: '00000000-0000-4000-8000-000000000003', code: '70123456', documentNumber: '70123456', name: 'Ana Alumna' };

describe('StudentRecordsService', () => {
  it('rejects attendance outside an opened group', async () => {
    const service = new StudentRecordsService({} as never, {} as never);
    await expect(service.saveAttendance(group({ status: 'COMPLETED' }), group().teacherUserId, [student], [{ studentUserId: student.userId, status: 'PRESENT' }])).rejects.toThrow('Solo se registra asistencia');
  });

  it('rejects grade changes after the two-week closure window', async () => {
    const service = new StudentRecordsService({} as never, {} as never);
    await expect(service.saveGrades(group({ status: 'COMPLETED', endsAt: '2020-01-01T00:00:00.000Z' }), group().teacherUserId, [student], [{ studentUserId: student.userId, listeningReading: 20, writing: 20, testOne: 20, participation: 20, finalTest: 20 }])).rejects.toThrow('plazo de dos semanas');
  });

  it('rejects a teacher who does not own the group', async () => {
    const service = new StudentRecordsService({} as never, {} as never);
    await expect(service.roster(group(), '00000000-0000-4000-8000-000000000099', [student])).rejects.toThrow('no es válido');
  });

  it('does not expose an attachment outside its group', async () => {
    const db = { studentAttendance: { findUnique: async () => ({ groupId: group().id }) } };
    const service = new StudentRecordsService(db as never, {} as never);
    await expect(service.attachment('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000099')).rejects.toThrow('No tienes acceso');
  });

  it('returns a private attachment only after authorization checks', async () => {
    const db = {
      studentAttendance: { findUnique: async () => ({ groupId: group().id }) },
      studentJustification: { findUnique: async () => ({ objectKey: '00000000-0000-4000-8000-000000000011', fileName: 'sustento.pdf', contentType: 'application/pdf' }) },
    };
    const files = { read: async () => Buffer.from('private-file') };
    const service = new StudentRecordsService(db as never, files as never);
    await expect(service.attachment('00000000-0000-4000-8000-000000000010', group().id)).resolves.toEqual({ name: 'sustento.pdf', contentType: 'application/pdf', base64: Buffer.from('private-file').toString('base64') });
  });
});
