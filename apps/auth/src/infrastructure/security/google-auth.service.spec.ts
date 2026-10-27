import { describe, expect, it } from 'vitest';

import { googleAccountEmail, googleStatesMatch } from './google-auth.service.js';

describe('google account email', () => {
  it('accepts a verified institutional account and rejects the rest', () => {
    expect(
      googleAccountEmail({
        email: 'Ana@UPRIT.edu.pe',
        email_verified: true,
        hd: 'uprit.edu.pe',
      }),
    ).toBe('ana@uprit.edu.pe');
    expect(googleAccountEmail({ email: 'ana@gmail.com', email_verified: true })).toBeNull();
    expect(
      googleAccountEmail({ email: 'ana@uprit.edu.pe', email_verified: false, hd: 'uprit.edu.pe' }),
    ).toBeNull();
    expect(
      googleAccountEmail({ email: 'ana@uprit.edu.pe', email_verified: true, hd: 'gmail.com' }),
    ).toBeNull();
  });

  it('compares the oauth state only when both values match', () => {
    const state = 'a'.repeat(43);
    expect(googleStatesMatch(state, state)).toBe(true);
    expect(googleStatesMatch(state, `${state}x`)).toBe(false);
    expect(googleStatesMatch('short', 'short')).toBe(false);
  });
});
