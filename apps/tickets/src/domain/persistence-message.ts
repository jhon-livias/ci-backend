const GENERIC = 'No pudimos completar la operación. Inténtalo nuevamente.';

const flatten = (value: unknown, depth = 0): string => {
  if (depth > 6 || value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).toLowerCase();
  if (Array.isArray(value)) return value.map((item) => flatten(item, depth + 1)).join(' ');
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map((item) => flatten(item, depth + 1)).join(' ');
  }
  return '';
};

/** Traduce un fallo de base de datos a un aviso. Null si el error no viene de la persistencia. */
export const persistenceMessage = (error: unknown): string | null => {
  const text = flatten(error);
  if (!/\bp20\d{2}\b|\bpostgres\b|\bprisma\b|unique constraint|duplicate key|foreign key|violates/.test(text)) return null;
  const has = (token: string): boolean => text.includes(token);
  const user = has('userid') || has('user_id');
  const area = has('areaid') || has('area_id');
  if (user && area) return 'Esa persona ya está inscrita en el área.';
  if (area && has('name')) return 'Ya existe una categoría con ese nombre en el área.';
  if (has('document')) return 'Ese DNI ya está registrado.';
  if (user || has('email')) return 'Ese correo ya está registrado.';
  if (has('code') && has('ticket')) return 'No pudimos emitir el número de ticket. Inténtalo nuevamente.';
  if (has('code')) return 'Ya existe un área con esas siglas.';
  if (text.includes('foreign key') || text.includes('p2003') || text.includes('p2014')) return 'No se puede completar porque el registro tiene información relacionada.';
  return GENERIC;
};

export const publicMessage = (value: unknown, fallback = GENERIC): string => {
  const raw = value && typeof value === 'object' && 'message' in value ? (value as { message: unknown }).message : value;
  const text = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').join(' ') : typeof raw === 'string' ? raw : '';
  if (!text.trim()) return fallback;
  return persistenceMessage(text) ?? (/p20\d{2}|postgres|prisma|sqlstate/i.test(text) ? fallback : text);
};
