import { Body, Controller, Delete, Get, Header, HttpCode, Injectable, Param, ParseUUIDPipe, Post, Put, Query, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { SiteDto } from '../../../../../../libs/contracts/src/site.dto.js';
import { SitesService } from '../../application/sites.service.js';

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
  constructor(private readonly sites: SitesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.sites.list();
  }

  @Get('geography/departments')
  departments() {
    return this.sites.departments();
  }

  @Get('geography/provinces')
  provinces(@Query() query: GeographyParentDto) {
    return this.sites.provinces(query.code);
  }

  @Get('geography/districts')
  districts(@Query() query: GeographyParentDto) {
    return this.sites.districts(query.code);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.detail(id);
  }

  @Post()
  create(@Body() dto: SiteDto) {
    return this.sites.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SiteDto) {
    return this.sites.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sites.remove(id);
  }
}
