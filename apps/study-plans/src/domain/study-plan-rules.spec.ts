import { describe, expect, it } from 'vitest';

import { decodePdf, isCreditValue, isCurriculumYear, isCourseCode, visibleCurriculum } from './study-plan-rules.js';

describe('reglas de planes de estudio', () => {
  it('acepta vigencia, código y créditos del prototipo', () => {
    expect(isCurriculumYear('2024')).toBe(true);
    expect(isCurriculumYear('1999')).toBe(false);
    expect(isCourseCode('EG101')).toBe(true);
    expect(isCourseCode('eg101')).toBe(false);
    expect(isCreditValue(4)).toBe(true);
    expect(isCreditValue(3.5)).toBe(true);
    expect(isCreditValue(3.2)).toBe(false);
  });

  it('acepta solo bytes que empiezan como PDF y rechaza HTML renombrado', () => {
    const pdf = Buffer.from('%PDF-1.7\n').toString('base64');
    expect(decodePdf(pdf)?.[0]).toBe(0x25);
    expect(decodePdf(Buffer.from('<html></html>').toString('base64'))).toBeNull();
    expect(decodePdf('%PDF-1.7')).toBeNull();
  });

  it('oculta un plan inactivo al docente y lo deja visible para facultad', () => {
    expect(visibleCurriculum('teacher', 'INACTIVE')).toBe(false);
    expect(visibleCurriculum('teacher', 'ACTIVE')).toBe(true);
    expect(visibleCurriculum('faculty', 'INACTIVE')).toBe(true);
  });
});
