import { describe, expect, it } from 'vitest';

import { requiresMfa } from './privileged-mfa.js';

describe('requiresMfa', () => {
  it('exige MFA a administrador, director y gestores de tickets o facultad', () => {
    expect(requiresMfa(['ADMINISTRATOR'])).toBe(true);
    expect(requiresMfa(['DIRECTOR'])).toBe(true);
    expect(requiresMfa([], ['tickets.admin'])).toBe(true);
    expect(requiresMfa([], ['tickets.area_manager'])).toBe(true);
    expect(requiresMfa([], ['study-plans.faculty'])).toBe(true);
  });

  it('deja el segundo factor opcional para estudiante, docente y solicitante', () => {
    expect(requiresMfa(['STUDENT'])).toBe(false);
    expect(requiresMfa(['TEACHER'])).toBe(false);
    expect(requiresMfa(['ADVISOR'])).toBe(false);
    expect(requiresMfa([], ['tickets.assistant'])).toBe(false);
    expect(requiresMfa([], ['tickets.requester'])).toBe(false);
    expect(requiresMfa([], ['study-plans.teacher'])).toBe(false);
  });
});
