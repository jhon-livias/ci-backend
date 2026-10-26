export const ACADEMIC_CATALOG_KINDS = ['LANGUAGE', 'LEVEL', 'STUDY_TYPE', 'MODALITY', 'GROUP_TYPE'] as const;
export type AcademicCatalogKind = (typeof ACADEMIC_CATALOG_KINDS)[number];

export const ACADEMIC_CATALOG_TITLES: Readonly<Record<AcademicCatalogKind, string>> = {
  LANGUAGE: 'Idiomas',
  LEVEL: 'Niveles',
  STUDY_TYPE: 'Tipos de estudio',
  MODALITY: 'Modalidades',
  GROUP_TYPE: 'Tipo de grupo',
};

export interface AcademicRules {
  readonly minStudents: number;
  readonly maxStudents: number;
  readonly absencePercent: number;
  readonly passingGrade: number;
  readonly evaluationsPerGroup: number;
  readonly maxScorePerEvaluation: number;
}

export class AcademicConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AcademicConfigError';
  }
}

export const isAcademicCatalogKind = (value: string): value is AcademicCatalogKind =>
  ACADEMIC_CATALOG_KINDS.some((kind) => kind === value);

export const normalizeCatalogName = (value: string): string => {
  const name = value.replace(/\s+/g, ' ').trim();
  if (!/^[^<>]{1,80}$/u.test(name)) throw new AcademicConfigError('El nombre del elemento no es válido.');
  return name;
};

const integer = (value: number, min: number, max: number): boolean => Number.isInteger(value) && value >= min && value <= max;

export const normalizeAcademicRules = (input: AcademicRules): AcademicRules => {
  if (!integer(input.minStudents, 0, 500) || !integer(input.maxStudents, 0, 500)) {
    throw new AcademicConfigError('El mínimo y el máximo de alumnos deben estar entre 0 y 500.');
  }
  if (input.minStudents > input.maxStudents) throw new AcademicConfigError('El mínimo de alumnos no puede ser mayor que el máximo.');
  if (!integer(input.absencePercent, 0, 100)) throw new AcademicConfigError('El porcentaje de inasistencia debe estar entre 0 y 100.');
  if (!integer(input.passingGrade, 0, 100)) throw new AcademicConfigError('La nota mínima aprobatoria no puede superar 100.');
  if (!integer(input.evaluationsPerGroup, 1, 20) || !integer(input.maxScorePerEvaluation, 1, 100)) {
    throw new AcademicConfigError('Las evaluaciones y el puntaje máximo deben ser mayores que cero.');
  }
  return {
    minStudents: input.minStudents,
    maxStudents: input.maxStudents,
    absencePercent: input.absencePercent,
    passingGrade: input.passingGrade,
    evaluationsPerGroup: input.evaluationsPerGroup,
    maxScorePerEvaluation: input.maxScorePerEvaluation,
  };
};
