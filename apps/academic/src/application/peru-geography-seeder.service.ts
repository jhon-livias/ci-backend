import { Injectable, OnModuleInit } from '@nestjs/common';
import { PERU_DEPARTMENTS, PERU_DISTRICTS, PERU_PROVINCES } from '../infrastructure/geography/peru-geography.seed.js';
import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';

/** Idempotently loads immutable official reference data after migrations. */
@Injectable()
export class PeruGeographySeeder implements OnModuleInit {
  constructor(private readonly db: AcademicPrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.db.$connect();
    await this.db.$transaction([
      this.db.peruDepartment.createMany({ data: [...PERU_DEPARTMENTS], skipDuplicates: true }),
      this.db.peruProvince.createMany({ data: [...PERU_PROVINCES], skipDuplicates: true }),
      this.db.peruDistrict.createMany({ data: [...PERU_DISTRICTS], skipDuplicates: true }),
    ]);
    // The initial site was intentionally created without an invented address.
    // Its official district is now known from the reference catalog.
    await this.db.site.updateMany({
      where: { code: 'TRUJILLO', districtCode: null, deletedAt: null },
      data: { districtCode: '1130101' },
    });
  }
}
