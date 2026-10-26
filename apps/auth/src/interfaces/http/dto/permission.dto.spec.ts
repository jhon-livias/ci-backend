import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { SavePermissionDto, UpdatePermissionDto } from './permission.dto.js';

const options = { whitelist: true, forbidNonWhitelisted: true };

describe('permission dto', () => {
  it('rejects markup, unknown fields and a non-boolean state', async () => {
    const created = await validate(plainToInstance(SavePermissionDto, {
      moduleCode: 'estudiante',
      name: '<script>',
      enabled: 'true',
      functionalities: ['Total'],
      role: 'ADMINISTRATOR',
    }), options);
    expect(created.length).toBeGreaterThan(0);

    const updated = await validate(plainToInstance(UpdatePermissionDto, { enabled: false }), options);
    expect(updated).toHaveLength(0);
  });
});
