import { describe, expect, it } from 'vitest';

import { FollowUpService } from './follow-up.service.js';

describe('FollowUpService', () => {
  it('returns an empty consultation snapshot', async () => {
    const snapshot = await new FollowUpService({ studentAttendance: { findMany: async () => [] }, teacherSession: { findMany: async () => [] } } as never).read();
    expect(snapshot.absenceLimit).toBe(30);
    expect(snapshot.alerts).toEqual([]);
    expect(snapshot.students).toEqual([]);
    expect(snapshot.teachers).toEqual([]);
    expect(snapshot.absences).toEqual([]);
  });
});
