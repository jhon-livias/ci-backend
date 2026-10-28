import { Controller, ForbiddenException, Get, Header, HttpException, Param, ParseUUIDPipe, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

@Controller('auth/teacher')
export class TeacherPortalController {
  constructor(private readonly auth: AuthenticationService) {}

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  async groups(@Req() request: FastifyRequest) {
    const user = await this.authorize(request, 'teaching.read');
    return this.academic('GET', `/api/v1/internal/teaching/groups?teacherUserId=${user.id}`);
  }

  @Get('groups/:id/sessions')
  @Header('Cache-Control', 'no-store')
  async sessions(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.read');
    await this.ownedGroup(user.id, id);
    return this.attendance('GET', `/api/v1/internal/teacher-sessions?groupId=${id}&teacherUserId=${user.id}`);
  }

  @Post('groups/:id/check-in')
  @Header('Cache-Control', 'no-store')
  async checkIn(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.update');
    const group = await this.ownedGroup(user.id, id);
    return this.attendance('POST', '/api/v1/internal/teacher-sessions/check-in', this.punch(group, user.id));
  }

  @Post('groups/:id/check-out')
  @Header('Cache-Control', 'no-store')
  async checkOut(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.update');
    const group = await this.ownedGroup(user.id, id);
    return this.attendance('POST', '/api/v1/internal/teacher-sessions/check-out', this.punch(group, user.id));
  }

  private async ownedGroup(teacherUserId: string, groupId: string): Promise<Record<string, unknown>> {
    const body = await this.academic('GET', `/api/v1/internal/teaching/groups?teacherUserId=${teacherUserId}`);
    const groups = isRecord(body) && Array.isArray(body['groups']) ? body['groups'] : [];
    const group = groups.find((item) => isRecord(item) && item['id'] === groupId);
    if (!group || !isRecord(group)) throw new HttpException('Ese grupo no está asignado a este docente.', 404);
    return group;
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private punch(group: Record<string, unknown>, teacherUserId: string) {
    const slots = Array.isArray(group['slots']) ? group['slots'] : [];
    return {
      id: group['id'],
      code: group['code'],
      language: group['language'],
      level: group['level'],
      status: group['status'],
      startsAt: group['startsAt'],
      endsAt: group['endsAt'],
      teacherUserId,
      slots: slots.flatMap((item) => {
        if (!isRecord(item) || typeof item['day'] !== 'string') return [];
        return [{
          day: item['day'],
          classKind: item['classKind'],
          startMinutes: item['startMinutes'],
          endMinutes: item['endMinutes'],
        }];
      }),
    };
  }

  private academic(method: string, path: string) {
    return this.forward(method, process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002', path);
  }

  private attendance(method: string, path: string, body?: unknown) {
    return this.forward(method, process.env.ATTENDANCE_GRADES_UPSTREAM ?? 'http://attendance-grades:3005', path, body);
  }

  private async forward(method: string, upstream: string, path: string, body?: unknown): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    let response: Response;
    try {
      response = await fetch(`${upstream}${path}`, {
        method,
        headers: { 'x-internal-secret': secret, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException();
    }
    if (!response.ok) {
      if ([400, 404, 409].includes(response.status)) throw new HttpException(await this.safeMessage(response), response.status);
      throw new ServiceUnavailableException();
    }
    return response.status === 204 ? undefined : await response.json();
  }

  private async safeMessage(response: Response): Promise<string> {
    const body = await response.json().catch(() => null);
    const message = isRecord(body) ? body['message'] : undefined;
    return typeof message === 'string' && /^[^<>]{1,160}$/u.test(message) ? message : 'No se pudo completar la operación.';
  }
}
