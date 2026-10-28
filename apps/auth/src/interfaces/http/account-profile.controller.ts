import { Body, Controller, Get, Header, Patch, Req, UnauthorizedException } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';

import { AccountProfileService } from '../../application/account-profile.service.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { UpdateAccountProfileDto } from './dto/update-account-profile.dto.js';

@Controller('auth/profile')
export class AccountProfileController {
  constructor(
    private readonly profiles: AccountProfileService,
    private readonly authentication: AuthenticationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async get(@Req() request: FastifyRequest) {
    const session = await this.session(request);
    return this.profiles.get(session.user.id);
  }

  @Patch()
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  @Header('Cache-Control', 'no-store')
  async update(@Req() request: FastifyRequest, @Body() dto: UpdateAccountProfileDto) {
    const session = await this.session(request);
    const csrf = Array.isArray(request.headers['x-csrf-token']) ? request.headers['x-csrf-token'][0] : request.headers['x-csrf-token'];
    if (!csrf || csrf !== session.csrfToken) throw new UnauthorizedException();
    return this.profiles.update(session.user.id, dto);
  }

  private session(request: FastifyRequest) {
    const accessToken = request.cookies?.['ci_access'];
    if (!accessToken) throw new UnauthorizedException();
    return this.authentication.restore(accessToken);
  }
}
