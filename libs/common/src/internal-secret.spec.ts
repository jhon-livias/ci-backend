import { describe, expect, it } from 'vitest';

import { internalSecretForUpstream, internalSecretMatches } from './internal-secret.js';

const env = {
  ACADEMIC_INTERNAL_SECRET: 'a'.repeat(32),
  STUDENTS_INTERNAL_SECRET: 'b'.repeat(32),
  ATTENDANCE_INTERNAL_SECRET: 'c'.repeat(32),
} as NodeJS.ProcessEnv;

describe('internal secrets', () => {
  it('accepts only the secret of that service', () => {
    expect(internalSecretMatches('academic', 'a'.repeat(32), env)).toBe(true);
    expect(internalSecretMatches('academic', 'b'.repeat(32), env)).toBe(false);
    expect(internalSecretMatches('students', 'b'.repeat(32), env)).toBe(true);
  });

  it('picks the secret from the upstream host', () => {
    expect(internalSecretForUpstream('http://attendance-grades:3005', env)).toBe('c'.repeat(32));
    expect(internalSecretForUpstream('http://academic:3002', env)).toBe('a'.repeat(32));
    expect(internalSecretForUpstream('http://payments:3007', env)).toBeUndefined();
  });
});
