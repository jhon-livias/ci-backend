import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import type { FastifyReply, FastifyRequest } from 'fastify';

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

class EnrollmentTokenDto {
  @IsString()
  @Length(20, 4000)
  enrollmentToken!: string;
}

class ConfirmEnrollmentDto extends EnrollmentTokenDto {
  @IsString()
  @Matches(/^\d{6}$/u)
  code!: string;
}

const useSecureCookies = process.env.AUTH_COOKIE_SECURE !== 'false';

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

  @Post('enroll')
  @Header('Cache-Control', 'no-store')
  async beginEnrollment(@Body() dto: EnrollmentTokenDto) {
    const user = await this.authentication.readEnrollment(dto.enrollmentToken);
    const setup = await this.totp.begin(user.id, user.username);
    const qrcode = await import('qrcode');
    const api = 'toString' in qrcode && typeof qrcode.toString === 'function' ? qrcode : qrcode.default;
    const qrSvg = await api.toString(setup.otpauthUrl, { type: 'svg', margin: 1, width: 220 });
    return { secret: setup.secret, qrSvg };
  }

  @Post('enroll/confirm')
  @Header('Cache-Control', 'no-store')
  async confirmEnrollment(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply, @Body() dto: ConfirmEnrollmentDto) {
    const user = await this.authentication.readEnrollment(dto.enrollmentToken);
    await this.totp.confirm(user.id, dto.code);
    const session = await this.authentication.completeEnrollment(user.id, request.headers['user-agent']);
    response
      .setCookie('ci_access', session.accessToken, { httpOnly: true, secure: useSecureCookies, sameSite: 'lax', path: '/api', maxAge: 15 * 60 })
      .setCookie('ci_refresh', session.refreshToken, { httpOnly: true, secure: useSecureCookies, sameSite: 'strict', path: '/api/v1/auth', maxAge: 7 * 24 * 60 * 60 });
    return { user: session.user, csrfToken: session.csrfToken };
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
