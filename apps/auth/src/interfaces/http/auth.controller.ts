import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { LoginDto } from './dto/login.dto.js';

const accessCookieName = 'ci_access';
const refreshCookieName = 'ci_refresh';
const useSecureCookies = process.env.AUTH_COOKIE_SECURE !== 'false';

@Controller('auth')
export class AuthController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<{ user: Awaited<ReturnType<AuthenticationService['login']>>['user'] }> {
    const session = await this.authenticationService.login(input, request.headers['user-agent']);

    response
      .header('Cache-Control', 'no-store')
      .setCookie(accessCookieName, session.accessToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'lax',
        path: '/api',
        maxAge: 15 * 60,
      })
      .setCookie(refreshCookieName, session.refreshToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

    return { user: session.user };
  }
}
