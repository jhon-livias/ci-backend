import { describe, expect, it } from 'vitest';

import { limaCalendar } from './lima-calendar.js';
import { WEEK_DAYS } from './schedule-combo.js';

describe('lima calendar', () => {
  it('returns a calendar day in America/Lima', () => {
    const current = limaCalendar(new Date('2026-10-28T20:00:00.000Z'));
    expect(WEEK_DAYS).toContain(current.day);
    expect(current.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(current.clock).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
  });
});
