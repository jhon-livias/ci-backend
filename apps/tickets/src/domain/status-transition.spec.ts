import { describe, expect, it } from 'vitest';

import { nextStatuses, statusChangeError } from './status-transition.js';

describe('status transitions', () => {
  it('allows created to in review only', () => {
    expect(nextStatuses('CREATED')).toEqual(['IN_REVIEW']);
    expect(statusChangeError('CREATED', 'RESOLVED', 'listo', '')).toBeTruthy();
    expect(statusChangeError('CREATED', 'IN_REVIEW', '', '')).toBeNull();
  });

  it('rejects repeating the same status', () => {
    expect(statusChangeError('IN_REVIEW', 'IN_REVIEW', 'nota', '')).toBe('Ese estado ya está registrado.');
  });

  it('requires assignment and comment when deriving', () => {
    expect(statusChangeError('IN_REVIEW', 'DERIVED', 'motivo', '')).toBeTruthy();
    expect(statusChangeError('IN_REVIEW', 'DERIVED', 'motivo suficiente', 'Sergio Torres')).toBeNull();
  });
});
