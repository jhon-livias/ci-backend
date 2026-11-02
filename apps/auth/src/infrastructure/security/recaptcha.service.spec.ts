import { describe, expect, it } from 'vitest';

import { recaptchaAllowedHostnames, recaptchaHostnames } from './recaptcha.service.js';

describe('recaptcha hostnames', () => {
  it('keeps a bare host and strips a pasted URL', () => {
    expect(recaptchaHostnames('localhost, https://sistema-idiomas.uprit.edu.pe/')).toEqual([
      'localhost',
      'sistema-idiomas.uprit.edu.pe',
    ]);
  });

  it('adds application origins so Tickets can login without a separate recaptcha host list', () => {
    expect(
      recaptchaAllowedHostnames(
        'localhost',
        'https://sistema-idiomas.uprit.edu.pe,https://tickets.uprit.edu.pe,https://identidad.uprit.edu.pe',
      ),
    ).toEqual([
      'localhost',
      'sistema-idiomas.uprit.edu.pe',
      'tickets.uprit.edu.pe',
      'identidad.uprit.edu.pe',
    ]);
  });
});