import { describe, expect, it } from 'vitest';

import { TeacherSessionsService } from './teacher-sessions.service.js';

const group = {
  id: '00000000-0000-4000-8000-000000000001', code: 'G10', language: 'Inglés', level: 'Básico 1', status: 'OPENED',
  startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-31T00:00:00.000Z', teacherUserId: '00000000-0000-4000-8000-000000000002', teacherName: 'Docente Prueba', teacherDocument: '70123456', slots: [],
};

describe('TeacherSessionsService justification', () => {
  it('requires both reason and attachment', async () => {
    const service = new TeacherSessionsService({} as never, {} as never);
    await expect(service.justifyAbsence(group, group.teacherUserId, '00000000-0000-4000-8000-000000000003', '', undefined)).rejects.toThrow('motivo y el adjunto');
  });

  it('rejects a justification outside the assigned group', async () => {
    const service = new TeacherSessionsService({} as never, {} as never);
    await expect(service.justifyAbsence(group, '00000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000003', 'Motivo válido', { name: 'sustento.pdf', contentType: 'application/pdf', base64: 'dGVzdA==' })).rejects.toThrow('no está asignado');
  });
});
