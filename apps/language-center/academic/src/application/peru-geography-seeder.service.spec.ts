import { describe, expect, it, vi } from 'vitest';
import { PeruGeographySeeder } from './peru-geography-seeder.service.js';

describe('PeruGeographySeeder', () => {
  it('loads each geographic level idempotently', async () => {
    const createMany = vi.fn().mockReturnValue({});
    const transaction = vi.fn().mockResolvedValue([]);
    const connect = vi.fn().mockResolvedValue(undefined);
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const seeder = new PeruGeographySeeder({ $connect: connect, $transaction: transaction, peruDepartment: { createMany }, peruProvince: { createMany }, peruDistrict: { createMany }, site: { updateMany } } as never);
    await seeder.onModuleInit();
    expect(createMany).toHaveBeenCalledTimes(3);
    expect(createMany.mock.calls.every(([input]) => input.skipDuplicates === true)).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { districtCode: '1130101' } }));
  });
});
