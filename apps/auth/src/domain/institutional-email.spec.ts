import { describe, expect, it } from 'vitest';

import { loginIdentifier, normalizeInstitutionalEmail } from './institutional-email.js';

describe('institutional email', () => {
  it('accepts only the institutional domain and lowercases it', () => {
    expect(normalizeInstitutionalEmail(' Carlos@UPRIT.EDU.PE ')).toBe('carlos@uprit.edu.pe');
    expect(normalizeInstitutionalEmail('a.b+tag@uprit.edu.pe')).toBe('a.b+tag@uprit.edu.pe');
  });

  it('rejects other domains, suffixes and malformed addresses', () => {
    expect(normalizeInstitutionalEmail('carlos@gmail.com')).toBeNull();
    expect(normalizeInstitutionalEmail('carlos@uprit.edu.pe.evil.com')).toBeNull();
    expect(normalizeInstitutionalEmail('carlos@eviluprit.edu.pe')).toBeNull();
    expect(normalizeInstitutionalEmail('carlos@mail.uprit.edu.pe')).toBeNull();
    expect(normalizeInstitutionalEmail('carlos@uprit.edu.pe@uprit.edu.pe')).toBeNull();
    expect(normalizeInstitutionalEmail('carlos..haro@uprit.edu.pe')).toBeNull();
    expect(normalizeInstitutionalEmail('@uprit.edu.pe')).toBeNull();
  });

  it('keeps a username and blocks a foreign email before any account lookup', () => {
    expect(loginIdentifier(' Admin ')).toBe('admin');
    expect(loginIdentifier('admin@uprit.edu.pe')).toBe('admin@uprit.edu.pe');
    expect(loginIdentifier('admin@gmail.com')).toBeNull();
  });
});
