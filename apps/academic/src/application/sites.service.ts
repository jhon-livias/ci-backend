import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { SiteDto } from '../../../../libs/contracts/src/site.dto.js';
import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';

const siteSelection = {
  id: true, code: true, name: true, location: true, active: true, districtCode: true,
  street: true, postalCode: true, phone: true, email: true, contactName: true, contactPhone: true,
} as const;

const siteData = (dto: SiteDto) => ({
  code: dto.code, name: dto.name, location: dto.location || null, active: dto.active,
  street: dto.street || null, postalCode: dto.postalCode || null, phone: dto.phone || null,
  email: dto.email || null, contactName: dto.contactName || null, contactPhone: dto.contactPhone || null,
  districtCode: dto.districtCode || null,
});

@Injectable()
export class SitesService {
  constructor(private readonly db: AcademicPrismaService) {}

  list() {
    return this.db.site.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, location: true, active: true, districtCode: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async detail(id: string) {
    const site = await this.db.site.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...siteSelection,
        geographicDistrict: {
          select: {
            code: true,
            name: true,
            province: { select: { code: true, name: true, department: { select: { code: true, name: true } } } },
          },
        },
      },
    });
    if (!site) throw new NotFoundException();
    return site;
  }

  departments() {
    return this.db.peruDepartment.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } });
  }

  provinces(code: string) {
    return this.db.peruProvince.findMany({ where: { departmentCode: code }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
  }

  districts(code: string) {
    return this.db.peruDistrict.findMany({ where: { provinceCode: code }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
  }

  async create(dto: SiteDto) {
    try {
      return await this.db.site.create({ data: siteData(dto), select: siteSelection });
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async update(id: string, dto: SiteDto) {
    try {
      const result = await this.db.site.updateMany({ where: { id, deletedAt: null }, data: siteData(dto) });
      if (!result.count) throw new NotFoundException();
      return await this.db.site.findFirstOrThrow({ where: { id, deletedAt: null }, select: siteSelection });
    } catch (error) {
      this.rethrowPersistence(error);
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.db.site.updateMany({ where: { id, deletedAt: null }, data: { active: false, deletedAt: new Date() } });
    if (!result.count) throw new NotFoundException();
  }

  private rethrowPersistence(error: unknown): never {
    if (error instanceof NotFoundException) throw error;
    if (isUniqueConflict(error)) throw new ConflictException('El código ya está registrado.');
    if (isForeignKeyConflict(error)) throw new BadRequestException('El distrito no es válido.');
    throw error;
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isForeignKeyConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003';
}
