import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

const accessCookieName = 'ci_access';
const refreshCookieName = 'ci_refresh';
const useSecureCookies = process.env.AUTH_COOKIE_SECURE !== 'false';

@Controller('auth')
export class AuthController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  async login(@Body() input: LoginDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    const session = await this.authenticationService.login(input, request.headers['user-agent']);
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return { user: session.user, csrfToken: session.csrfToken };
  }

  @Get('session')
  async session(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    const accessToken = request.cookies[accessCookieName];
    if (!accessToken) throw new UnauthorizedException();
    const session = await this.authenticationService.restore(accessToken);
    response.header('Cache-Control', 'no-store');
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply) {
    const refreshToken = request.cookies[refreshCookieName];
    if (!refreshToken) throw new UnauthorizedException();
    const session = await this.authenticationService.refresh(refreshToken, request.headers['user-agent']);
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return { user: session.user, csrfToken: session.csrfToken };
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@Body() dto: ChangePasswordDto, @Req() request: FastifyRequest): Promise<void> {
    const accessToken = request.cookies[accessCookieName];
    if (!accessToken) throw new UnauthorizedException();
    const session = await this.authenticationService.restore(accessToken);
    const csrf = Array.isArray(request.headers['x-csrf-token']) ? request.headers['x-csrf-token'][0] : request.headers['x-csrf-token'];
    if (!csrf || csrf !== session.csrfToken) throw new UnauthorizedException();
    await this.authenticationService.replacePassword(session.user.id, dto.password);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) response: FastifyReply): Promise<void> {
    await this.authenticationService.logout(
      request.cookies[accessCookieName],
      request.cookies[refreshCookieName],
      Array.isArray(request.headers['x-csrf-token']) ? request.headers['x-csrf-token'][0] : request.headers['x-csrf-token'],
    );
    response.clearCookie(accessCookieName, { path: '/api' }).clearCookie(refreshCookieName, { path: '/api/v1/auth' });
  }

  private setSessionCookies(response: FastifyReply, accessToken: string, refreshToken: string): void {
    response
      .header('Cache-Control', 'no-store')
      .setCookie(accessCookieName, accessToken, {
        httpOnly: true, secure: useSecureCookies, sameSite: 'lax', path: '/api', maxAge: 15 * 60,
      })
      .setCookie(refreshCookieName, refreshToken, {
        httpOnly: true, secure: useSecureCookies, sameSite: 'strict', path: '/api/v1/auth', maxAge: 7 * 24 * 60 * 60,
      });
  }

}
