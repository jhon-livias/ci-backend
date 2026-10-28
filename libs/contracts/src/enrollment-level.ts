export type EnrollmentProgressStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'APPROVED' | 'FAILED' | 'WITHDRAWN';

export type EnrollmentLevelOffer = {
  readonly level: string | null;
  readonly blocked: boolean;
};

const same = (left: string, right: string): boolean => left.toLocaleLowerCase('es') === right.toLocaleLowerCase('es');

/** Nivel que el alumno puede matricular según el catálogo y su última matrícula del idioma. */
export const nextOfferedLevel = (
  levels: readonly string[],
  last: { readonly level: string; readonly status: EnrollmentProgressStatus } | null,
): EnrollmentLevelOffer => {
  if (levels.length === 0) return { level: null, blocked: false };
  if (!last) return { level: levels[0] ?? null, blocked: false };
  if (last.status === 'ACTIVE' || last.status === 'PENDING_PAYMENT') return { level: last.level, blocked: true };
  if (last.status === 'FAILED' || last.status === 'WITHDRAWN') return { level: last.level, blocked: false };
  const index = levels.findIndex((item) => same(item, last.level));
  if (index >= 0 && index < levels.length - 1) return { level: levels[index + 1] ?? null, blocked: false };
  return { level: null, blocked: false };
};
