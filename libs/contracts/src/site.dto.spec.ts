import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SiteDto } from './site.dto.js';

describe('SiteDto', () => {
  const valid = { code: 'TRUJILLO', name: 'Trujillo', active: true, districtCode: '1130101', postalCode: '13001', email: 'sede@example.com' };
  it('accepts valid details', async () => { expect(await validate(plainToInstance(SiteDto, valid), { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0); });
  it('rejects invalid and unlisted properties', async () => {
    const input = { ...valid, postalCode: '123456', email: 'incorrecto', active: true, role: 'ADMINISTRATOR' };
    const errors = await validate(plainToInstance(SiteDto, input), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['postalCode', 'email', 'role']));
  });
  it('rejects HTML in address fields', async () => {
    const errors = await validate(plainToInstance(SiteDto, { ...valid, street: '<script>' }));
    expect(errors.map((error) => error.property)).toContain('street');
  });
});
