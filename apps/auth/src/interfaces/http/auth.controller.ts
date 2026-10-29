import { randomBytes } from 'node:crypto';

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { SsoService } from '../../application/sso.service.js';
import { PasswordRecoveryService } from '../../application/password-recovery.service.js';
import {
  GoogleAuthService,
  googleAuthConfigured,
  googleAuthorizationUrl,
  googleStatesMatch,
} from '../../infrastructure/security/google-auth.service.js';
import { RecaptchaService } from '../../infrastructure/security/recaptcha.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  ConfirmPasswordRecoveryDto,
  RequestPasswordRecoveryDto,
} from './dto/password-recovery.dto.js';

const accessCookieName = 'ci_access';
const refreshCookieName = 'ci_refresh';
const googleStateCookieName = 'ci_google_state';
const useSecureCookies = process.env.AUTH_COOKIE_SECURE !== 'false';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly sso: SsoService,
    private readonly recovery: PasswordRecoveryService,
    private readonly recaptcha: RecaptchaService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Get('google')
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  startGoogle(@Res() response: FastifyReply): FastifyReply {
    if (!googleAuthConfigured()) return response.redirect('/login?google=unconfigured', 302);
    const state = randomBytes(32).toString('base64url');
    response.setCookie(googleStateCookieName, state, {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      path: '/api/v1/auth/google',
      maxAge: 10 * 60,
    });
    return response.redirect(googleAuthorizationUrl(state), 302);
  }

  @Get('sso/authorize')
  @RouteConfig({ rateLimit: { max: 30, timeWindow: '1 minute' } })
  async authorizeSso(@Req() request: FastifyRequest, @Res() response: FastifyReply): Promise<FastifyReply> {
    const query = request.query as Record<string, unknown>;
    const clientId = query['client_id'];
    const redirectUri = query['redirect_uri'];
    const challenge = query['code_challenge'];
    const state = query['state'];
    if (query['response_type'] !== 'code' || typeof clientId !== 'string' || typeof redirectUri !== 'string' ||
      typeof challenge !== 'string' || query['code_challenge_method'] !== 'S256' ||
      (state !== undefined && (typeof state !== 'string' || state.length > 512))) {
      throw new ForbiddenException('Solicitud SSO inválida.');
    }
    const accessToken = request.cookies[accessCookieName];
    if (!accessToken) throw new UnauthorizedException('Inicie sesión para continuar con Tickets.');
    const session = await this.authenticationService.restore(accessToken);
    if (session.user.mustChangePassword) throw new ForbiddenException('Debe cambiar su contraseña antes de continuar.');
    const code = await this.sso.authorize({ user: session.user, clientId, redirectUri, codeChallenge: challenge });
    const destination = new URL(redirectUri);
    destination.searchParams.set('code', code);
    if (typeof state === 'string') destination.searchParams.set('state', state);
    response.header('Cache-Control', 'no-store');
    return response.redirect(destination.toString(), 302);
  }

  @Post('sso/token')
  @HttpCode(HttpStatus.OK)
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  async exchangeSsoCode(@Body() input: { client_id?: unknown; code?: unknown; redirect_uri?: unknown; code_verifier?: unknown }) {
    if (typeof input.client_id !== 'string' || typeof input.code !== 'string' ||
      typeof input.redirect_uri !== 'string' || typeof input.code_verifier !== 'string') {
      throw new ForbiddenException('Solicitud de canje SSO inválida.');
    }
    return this.sso.exchange({
      clientId: input.client_id,
      code: input.code,
      redirectUri: input.redirect_uri,
      codeVerifier: input.code_verifier,
    });
  }

  @Get('google/callback')
  @RouteConfig({ rateLimit: { max: 20, timeWindow: '1 minute' } })
  async finishGoogle(
    @Req() request: FastifyRequest,
    @Res() response: FastifyReply,
  ): Promise<FastifyReply> {
    const query = request.query as Record<string, unknown>;
    const state = typeof query['state'] === 'string' ? query['state'] : '';
    const code = typeof query['code'] === 'string' ? query['code'] : '';
    const expected = request.cookies[googleStateCookieName];
    response.clearCookie(googleStateCookieName, { path: '/api/v1/auth/google' });
    if (query['error'] === 'access_denied') return response.redirect('/login?google=denied', 302);
    if (!expected || !googleStatesMatch(expected, state) || !code) {
      return response.redirect('/login?google=failed', 302);
    }
    try {
      const email = await this.googleAuth.accountEmail(code);
      if (!email) return response.redirect('/login?google=unverified', 302);
      const session = await this.authenticationService.loginWithGoogle(
        email,
        request.headers['user-agent'],
      );
      this.setSessionCookies(response, session.accessToken, session.refreshToken);
      const destination = session.user.mustChangePassword ? '/cambiar-contrasena' : '/inicio';
      return response.redirect(destination, 302);
    } catch (error) {
      const destination = error instanceof UnauthorizedException ? 'unknown' : 'failed';
      return response.redirect(`/login?google=${destination}`, 302);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '1 minute' } })
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    await this.recaptcha.verifyLogin(input.recaptchaToken, request.ip);
    const session = await this.authenticationService.login(
      input,
      request.headers['user-agent'],
    );
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return { user: session.user, csrfToken: session.csrfToken };
  }

  @Get('session')
  async session(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const accessToken = request.cookies[accessCookieName];
    if (!accessToken) {
      response.status(HttpStatus.NO_CONTENT);
      return;
    }
    const session = await this.authenticationService.restore(accessToken);
    response.header('Cache-Control', 'no-store');
    return session;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const refreshToken = request.cookies[refreshCookieName];
    if (!refreshToken) {
      response.status(HttpStatus.NO_CONTENT);
      return;
    }
    const session = await this.authenticationService.refresh(
      refreshToken,
      request.headers['user-agent'],
    );
    this.setSessionCookies(response, session.accessToken, session.refreshToken);
    return { user: session.user, csrfToken: session.csrfToken };
  }

  @Post('password-recovery')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RouteConfig({ rateLimit: { max: 5, timeWindow: '15 minutes' } })
  async requestPasswordRecovery(
    @Body() dto: RequestPasswordRecoveryDto,
  ): Promise<void> {
    await this.recovery.request(dto.email);
  }

  @Post('password-recovery/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RouteConfig({ rateLimit: { max: 10, timeWindow: '15 minutes' } })
  async confirmPasswordRecovery(
    @Body() dto: ConfirmPasswordRecoveryDto,
  ): Promise<void> {
    await this.recovery.confirm(dto.email, dto.code, dto.password);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    const accessToken = request.cookies[accessCookieName];
    if (!accessToken) throw new UnauthorizedException();
    const session = await this.authenticationService.restore(accessToken);
    const csrf = Array.isArray(request.headers['x-csrf-token'])
      ? request.headers['x-csrf-token'][0]
      : request.headers['x-csrf-token'];
    if (!csrf || csrf !== session.csrfToken) throw new UnauthorizedException();
    await this.authenticationService.replacePassword(
      session.user.id,
      dto.password,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) response: FastifyReply,
  ): Promise<void> {
    await this.authenticationService.logout(
      request.cookies[accessCookieName],
      request.cookies[refreshCookieName],
      Array.isArray(request.headers['x-csrf-token'])
        ? request.headers['x-csrf-token'][0]
        : request.headers['x-csrf-token'],
    );
    response
      .clearCookie(accessCookieName, { path: '/api' })
      .clearCookie(refreshCookieName, { path: '/api/v1/auth' });
  }

  private setSessionCookies(
    response: FastifyReply,
    accessToken: string,
    refreshToken: string,
  ): void {
    response
      .header('Cache-Control', 'no-store')
      .setCookie(accessCookieName, accessToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'lax',
        path: '/api',
        maxAge: 15 * 60,
      })
      .setCookie(refreshCookieName, refreshToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60,
      });
  }
}
