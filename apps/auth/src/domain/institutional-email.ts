export const INSTITUTIONAL_EMAIL_DOMAIN = 'uprit.edu.pe';
export const INSTITUTIONAL_EMAIL_MESSAGE = 'Solo se acepta el dominio @uprit.edu.pe.';

const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?$/u;

/** Correo institucional normalizado, o null si el dominio o la forma no están permitidos. */
export const normalizeInstitutionalEmail = (value: string): string | null => {
  const email = value.normalize('NFKC').trim().toLowerCase();
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain !== INSTITUTIONAL_EMAIL_DOMAIN || local.includes('..') || !LOCAL_PART.test(local)) return null;
  return email;
};

export const isInstitutionalEmail = (value: string): boolean => normalizeInstitutionalEmail(value) !== null;

/**
 * Identificador de login. Un usuario sin @ se conserva. Un correo solo pasa si es del dominio institucional.
 * Null evita consultar la cuenta y no revela si existe.
 */
export const loginIdentifier = (value: string): string | null => {
  const identifier = value.normalize('NFKC').trim().toLowerCase();
  if (!identifier.includes('@')) return identifier;
  return normalizeInstitutionalEmail(identifier);
};
