import { describe, expect, it } from 'vitest';

import { formatTicketCode, ticketCodePrefix } from './ticket-code.js';

describe('ticket codes', () => {
  it('builds TIYYMM##### codes', () => {
    expect(ticketCodePrefix('TI', new Date('2026-11-02T12:00:00Z'))).toBe('TI2611');
    expect(formatTicketCode('TI2611', 12)).toBe('TI261100012');
  });
});
