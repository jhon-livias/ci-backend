import { describe, expect, it } from 'vitest';

import { recaptchaHostnames } from './recaptcha.service.js';

describe('recaptcha hostnames', () => {
  it('keeps a bare host and strips a pasted URL', () => {
    expect(recaptchaHostnames('localhost, https://sistema-idiomas.uprit.edu.pe/')).toEqual([
      'localhost',
      'sistema-idiomas.uprit.edu.pe',
    ]);
  });
});