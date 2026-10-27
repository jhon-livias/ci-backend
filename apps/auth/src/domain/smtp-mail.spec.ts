import { describe, expect, it } from 'vitest';

import { readSmtpSettings, recoveryMail } from './smtp-mail.js';

describe('smtp mail settings', () => {
  it('uses Gmail when the account and the app password are present', () => {
    expect(readSmtpSettings({ SMTP_USER: 'correo@empresa.com', SMTP_PASSWORD: 'app-password' })).toEqual({
      host: 'smtp.gmail.com',
      port: 587,
      user: 'correo@empresa.com',
      password: 'app-password',
      from: 'Centro de Idiomas UPRIT <correo@empresa.com>',
    });
  });

  it('stays disabled without a mailbox and rejects header injection', () => {
    expect(readSmtpSettings({})).toBeNull();
    expect(readSmtpSettings({ SMTP_USER: 'correo@empresa.com\nBcc: a@b.c', SMTP_PASSWORD: 'app-password' })).toBeNull();
  });

  it('builds a recovery message that contains only the code', () => {
    const message = recoveryMail('12345678');
    expect(message.subject).toBe('Código para restablecer tu contraseña');
    expect(message.text).toContain('Código: 12345678');
    expect(message.text).not.toContain('@uprit.edu.pe');
    expect(() => recoveryMail('1234')).toThrow(/código/);
  });
});
