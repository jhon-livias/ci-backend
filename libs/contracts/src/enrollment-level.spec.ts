import { describe, expect, it } from 'vitest';

import { nextOfferedLevel } from './enrollment-level.js';

describe('next offered enrollment level', () => {
  const levels = ['Básico 1', 'Básico 2', 'Intermedio'];

  it('offers the first catalog level when the student has no history in that language', () => {
    expect(nextOfferedLevel(levels, null)).toEqual({ level: 'Básico 1', blocked: false });
  });

  it('blocks a new enrollment while one is active or waiting for payment', () => {
    expect(nextOfferedLevel(levels, { level: 'Básico 1', status: 'ACTIVE' }).blocked).toBe(true);
    expect(nextOfferedLevel(levels, { level: 'Básico 1', status: 'PENDING_PAYMENT' }).blocked).toBe(true);
  });

  it('repeats the same level after a fail or withdrawal', () => {
    expect(nextOfferedLevel(levels, { level: 'Básico 1', status: 'FAILED' })).toEqual({ level: 'Básico 1', blocked: false });
    expect(nextOfferedLevel(levels, { level: 'Básico 2', status: 'WITHDRAWN' })).toEqual({ level: 'Básico 2', blocked: false });
  });

  it('advances to the next catalog level after approval', () => {
    expect(nextOfferedLevel(levels, { level: 'Básico 1', status: 'APPROVED' })).toEqual({ level: 'Básico 2', blocked: false });
  });

  it('has no further level when the last approved course is the last in the catalog', () => {
    expect(nextOfferedLevel(levels, { level: 'Intermedio', status: 'APPROVED' })).toEqual({ level: null, blocked: false });
  });
});
