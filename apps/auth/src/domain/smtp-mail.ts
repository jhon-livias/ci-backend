export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
}

const hasLineBreak = (value: string): boolean => /[\r\n]/.test(value);

/** Configuración SMTP. Null si falta la cuenta: el servicio sigue activo y no envía correo. */
export const readSmtpSettings = (env: NodeJS.ProcessEnv): SmtpSettings | null => {
  const user = env.SMTP_USER?.trim() ?? '';
  const password = env.SMTP_PASSWORD ?? '';
  if (!user || !password.trim() || hasLineBreak(user) || hasLineBreak(password)) return null;
  const host = env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT?.trim() || '587');
  const from = env.SMTP_FROM?.trim() || `Centro de Idiomas UPRIT <${user}>`;
  if (!host || hasLineBreak(host) || hasLineBreak(from) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port, user, password, from };
};

export const recoveryMail = (code: string): { subject: string; text: string } => {
  if (!/^\d{8}$/.test(code)) throw new Error('El código de recuperación no es válido.');
  return {
    subject: 'Código para restablecer tu contraseña',
    text: [
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta del Centro de Idiomas UPRIT.',
      '',
      `Código: ${code}`,
      '',
      'El código vence en 15 minutos y solo puede usarse una vez.',
      'Si no solicitaste este cambio, ignora este mensaje.',
    ].join('\n'),
  };
};
