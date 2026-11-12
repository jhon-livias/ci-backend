export const MAX_PDF_BYTES = 8_000_000;

export const isCurriculumYear = (value: string): boolean => /^20\d{2}$/u.test(value);

export const isCourseCode = (value: string): boolean => /^[A-Z]{2}\d{3}$/u.test(value);

export const isCreditValue = (value: number): boolean =>
  Number.isFinite(value) && value >= 0.5 && value <= 20 && Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;

export const visibleCurriculum = (role: 'faculty' | 'teacher', status: 'ACTIVE' | 'INACTIVE'): boolean =>
  role === 'faculty' || status === 'ACTIVE';

export const isPdfDocument = (bytes: Uint8Array): boolean =>
  bytes.length >= 5
  && bytes.length <= MAX_PDF_BYTES
  && bytes[0] === 0x25
  && bytes[1] === 0x50
  && bytes[2] === 0x44
  && bytes[3] === 0x46
  && bytes[4] === 0x2d;

export const decodePdf = (value: string): Uint8Array | null => {
  if (value.length < 8 || value.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return isPdfDocument(bytes) ? bytes : null;
};
