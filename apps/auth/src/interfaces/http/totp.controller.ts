import { Body, Controller, Get, Header, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { TotpService } from '../../application/totp.service.js';

class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/u)
  code!: string;
}

class DisableTotpDto extends TotpCodeDto {
  @IsString()
  @Matches(/^[^<>]{8,72}$/u)
  password!: string;
}

@Controller('auth/profile/totp')
export class TotpController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly totp: TotpService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async status(@Req() request: FastifyRequest) {
    const session = await this.session(request);
    return this.totp.status(session.user.id);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async begin(@Req() request: FastifyRequest) {
    const session = await this.session(request, true);
    return this.totp.begin(session.user.id, session.user.username);
  }

  @Post('confirm')
  @HttpCode(204)
  async confirm(@Req() request: FastifyRequest, @Body() dto: TotpCodeDto): Promise<void> {
    const session = await this.session(request, true);
    await this.totp.confirm(session.user.id, dto.code);
  }

  @Post('disable')
  @HttpCode(204)
  async disable(@Req() request: FastifyRequest, @Body() dto: DisableTotpDto): Promise<void> {
    const session = await this.session(request, true);
    await this.totp.disable(session.user.id, dto.password, dto.code);
  }

  private async session(request: FastifyRequest, requireCsrf = false) {
    const session = await this.authentication.restore(request.cookies?.['ci_access'] ?? '');
    if (requireCsrf) {
      const header = request.headers['x-csrf-token'];
      const csrf = Array.isArray(header) ? header[0] : header;
      if (csrf !== session.csrfToken) throw new UnauthorizedException();
    }
    return session;
  }
}
