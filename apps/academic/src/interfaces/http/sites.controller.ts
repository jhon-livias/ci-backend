import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, Injectable, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AcademicPrismaService } from '../../infrastructure/persistence/academic-prisma.service.js';
import { SiteDto } from './site.dto.js';

@Injectable()
export class InternalSitesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!secret || secret.length < 32 || typeof supplied !== 'string') throw new UnauthorizedException();
    const a = Buffer.from(secret); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

class GeographyParentDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/^\d{3}$|^\d{5}$/)
  code!: string;
}

@Controller('internal/sites')
@UseGuards(InternalSitesGuard)
export class SitesController {
  constructor(private readonly db: AcademicPrismaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list() {
    return this.db.site.findMany({ where: { deletedAt: null }, select: { id: true, code: true, name: true, location: true, active: true, districtCode: true }, orderBy: { name: 'asc' }, take: 500 });
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
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

  @Get('geography/departments')
  departments() { return this.db.peruDepartment.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } }); }

  @Get('geography/provinces')
  provinces(@Query() query: GeographyParentDto) { return this.db.peruProvince.findMany({ where: { departmentCode: query.code }, select: { code: true, name: true }, orderBy: { name: 'asc' } }); }

  @Get('geography/districts')
  districts(@Query() query: GeographyParentDto) { return this.db.peruDistrict.findMany({ where: { provinceCode: query.code }, select: { code: true, name: true }, orderBy: { name: 'asc' } }); }

  @Post()
  async create(@Body() dto: SiteDto) {
    try { return await this.db.site.create({ data: siteData(dto), select: siteSelection }); }
    catch (error) { if (isUniqueConflict(error)) throw new ConflictException('El código ya está registrado.'); if (isForeignKeyConflict(error)) throw new BadRequestException('El distrito no es válido.'); throw error; }
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteDto) {
    try {
      const result = await this.db.site.updateMany({ where: { id, deletedAt: null }, data: siteData(dto) });
      if (!result.count) throw new NotFoundException();
      return await this.db.site.findFirstOrThrow({ where: { id, deletedAt: null }, select: siteSelection });
    } catch (error) { if (isUniqueConflict(error)) throw new ConflictException('El código ya está registrado.'); if (isForeignKeyConflict(error)) throw new BadRequestException('El distrito no es válido.'); throw error; }
  }

  @Delete(':id') @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const result = await this.db.site.updateMany({ where: { id, deletedAt: null }, data: { active: false, deletedAt: new Date() } });
    if (!result.count) throw new NotFoundException();
  }
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isForeignKeyConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003';
}

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
