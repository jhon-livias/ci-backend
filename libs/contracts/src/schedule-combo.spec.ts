import { describe, expect, it } from 'vitest';

import { ScheduleComboError, clockToMinutes, formatRange, normalizeSlots } from './schedule-combo.js';

describe('schedule combo', () => {
  it('converts twelve-hour clocks to minutes', () => {
    expect(clockToMinutes('08:00', 'PM')).toBe(20 * 60);
    expect(formatRange(20 * 60, 22 * 60)).toBe('08:00 PM - 10:00 PM');
  });

  it('rejects an end time that is not later', () => {
    expect(() => normalizeSlots([{
      day: 'Lunes', classKind: 'SYNCHRONOUS', startMinutes: 20 * 60, endMinutes: 20 * 60,
    }])).toThrow(ScheduleComboError);
  });
});
