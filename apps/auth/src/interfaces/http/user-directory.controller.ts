import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { UserDirectoryService } from '../../application/user-directory.service.js';
import { UsersCreateGuard, UsersDeleteGuard, UsersReadGuard, UsersUpdateGuard } from './access-policy.guard.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { RequirePasswordChangeDto } from './dto/require-password-change.dto.js';
import { SaveUserDto, UpdateUserDto } from './dto/save-user.dto.js';

@Controller('auth/admin/users')
export class UserDirectoryController {
  constructor(
    private readonly directory: UserDirectoryService,
    private readonly authentication: AuthenticationService,
  ) {}

  @Get()
  @UseGuards(UsersReadGuard)
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListUsersDto) {
    return this.directory.list(query);
  }

  @Get(':id')
  @UseGuards(UsersReadGuard)
  @Header('Cache-Control', 'no-store')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.directory.get(id);
  }

  @Post()
  @UseGuards(UsersCreateGuard)
  @Header('Cache-Control', 'no-store')
  async create(@Req() request: FastifyRequest, @Body() dto: SaveUserDto) {
    return this.directory.create(dto, await this.actorId(request));
  }

  @Post(':id/password-reset')
  @UseGuards(UsersUpdateGuard)
  @Header('Cache-Control', 'no-store')
  async resetPassword(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.directory.resetPassword(id, await this.actorId(request));
  }

  @Patch(':id/password-policy')
  @UseGuards(UsersUpdateGuard)
  @Header('Cache-Control', 'no-store')
  async requirePasswordChange(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequirePasswordChangeDto): Promise<void> {
    await this.directory.requirePasswordChange(id, dto.mustChangePassword, await this.actorId(request));
  }

  @Delete(':id')
  @UseGuards(UsersDeleteGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  async remove(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const token = request.cookies?.['ci_access'];
    const session = await this.authentication.restore(token ?? '');
    await this.directory.remove(id, session.user.id);
  }

  @Patch(':id')
  @UseGuards(UsersUpdateGuard)
  @Header('Cache-Control', 'no-store')
  async update(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const token = request.cookies?.['ci_access'];
    const session = await this.authentication.restore(token ?? '');
    return this.directory.update(id, {
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      firstName: dto.firstName,
      paternalLastName: dto.paternalLastName,
      maternalLastName: dto.maternalLastName ?? '',
      siteId: dto.siteId ?? '',
      phone: dto.phone,
      mobileCountry: dto.mobileCountry ?? '+51',
      mobile: dto.mobile ?? '',
      email: dto.email,
      password: dto.password,
      enabled: dto.enabled,
      grants: dto.grants ?? [],
    }, session.user.id);
  }

  private async actorId(request: FastifyRequest): Promise<string> {
    const session = await this.authentication.restore(request.cookies?.['ci_access'] ?? '');
    return session.user.id;
  }
}
