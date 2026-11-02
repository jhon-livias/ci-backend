import { describe, expect, it } from 'vitest';

import { resolveTicketsRole } from './tickets-role.js';

describe('resolveTicketsRole', () => {
  it('prefers application role codes over username', () => {
    expect(resolveTicketsRole(['tickets.assistant'], 'administrador')).toBe('assistant');
  });

  it('falls back to demo usernames', () => {
    expect(resolveTicketsRole([], 'jefe-area')).toBe('area_manager');
  });
});
