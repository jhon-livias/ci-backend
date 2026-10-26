import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { UserTypeCatalogService } from '../../application/user-type-catalog.service.js';
import { PermissionsCreateGuard, PermissionsDeleteGuard, PermissionsReadGuard, PermissionsUpdateGuard } from './access-policy.guard.js';
import { ListUserTypesDto, SaveUserTypeDto, UpdateUserTypeDto } from './dto/user-type.dto.js';

@Controller('auth/admin/user-types')
export class UserTypesController {
  constructor(
    private readonly catalog: UserTypeCatalogService,
    private readonly authentication: AuthenticationService,
  ) {}

  @Get()
  @UseGuards(PermissionsReadGuard)
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListUserTypesDto) {
    return this.catalog.list(query);
  }

  @Post()
  @UseGuards(PermissionsCreateGuard)
  @Header('Cache-Control', 'no-store')
  async create(@Req() request: FastifyRequest, @Body() dto: SaveUserTypeDto) {
    return this.catalog.create(dto, await this.actorId(request));
  }

  @Patch(':id')
  @UseGuards(PermissionsUpdateGuard)
  @Header('Cache-Control', 'no-store')
  async update(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserTypeDto) {
    return this.catalog.update(id, dto, await this.actorId(request));
  }

  @Delete(':id')
  @UseGuards(PermissionsDeleteGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.remove(id, await this.actorId(request));
  }

  private async actorId(request: FastifyRequest): Promise<string> {
    const session = await this.authentication.restore(request.cookies?.['ci_access'] ?? '');
    return session.user.id;
  }
}
