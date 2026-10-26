import { describe, expect, it } from 'vitest';

import { AcademicConfigError, normalizeAcademicRules, normalizeCatalogName } from './academic-config.js';

const rules = {
  minStudents: 31,
  maxStudents: 50,
  absencePercent: 30,
  passingGrade: 60,
  evaluationsPerGroup: 5,
  maxScorePerEvaluation: 20,
};

describe('academic configuration', () => {
  it('collapses spaces in a catalog name', () => {
    expect(normalizeCatalogName('  Básico   3  ')).toBe('Básico 3');
  });

  it('rejects a catalog name with markup', () => {
    expect(() => normalizeCatalogName('Básico <1>')).toThrow(AcademicConfigError);
  });

  it('keeps the starting rules', () => {
    expect(normalizeAcademicRules(rules)).toEqual(rules);
  });

  it('rejects a minimum greater than the maximum', () => {
    expect(() => normalizeAcademicRules({ ...rules, minStudents: 60, maxStudents: 10 })).toThrow('El mínimo de alumnos no puede ser mayor que el máximo.');
  });
});
