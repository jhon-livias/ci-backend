import { Body, Controller, ForbiddenException, Get, Header, HttpException, Param, ParseUUIDPipe, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { AccountProfileService } from '../../application/account-profile.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
class AttendanceRowDto { @IsUUID('all') studentUserId!: string; @IsIn(['PRESENT', 'ABSENT', 'JUSTIFIED_ABSENCE', 'LATE']) status!: string; }
class GradeRowDto {
  @IsUUID('all') studentUserId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(20) listeningReading!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) writing!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) testOne!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) participation!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) finalTest!: number | null;
}
class AttendanceBody { @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => AttendanceRowDto) rows!: AttendanceRowDto[]; }
class GradesBody { @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => GradeRowDto) rows!: GradeRowDto[]; }
class JustificationFileDto { @IsString() name!: string; @IsString() contentType!: string; @IsString() base64!: string; }
class JustificationDto { @IsUUID('all') attendanceId!: string; @IsString() reason!: string; @IsOptional() @ValidateNested() @Type(() => JustificationFileDto) file?: JustificationFileDto; }

@Controller('auth/teacher')
export class TeacherPortalController {
  constructor(private readonly auth: AuthenticationService, private readonly profiles: AccountProfileService) {}

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
    const group = await this.ownedGroup(user.id, id);
    await this.attendance('POST', '/api/v1/internal/teacher-sessions/synchronize', await this.punch(group, user.id));
    return this.attendance('GET', `/api/v1/internal/teacher-sessions?groupId=${id}&teacherUserId=${user.id}`);
  }

  @Post('groups/:id/check-in')
  @Header('Cache-Control', 'no-store')
  async checkIn(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.update');
    const group = await this.ownedGroup(user.id, id);
    return this.attendance('POST', '/api/v1/internal/teacher-sessions/check-in', await this.punch(group, user.id));
  }

  @Post('groups/:id/check-out')
  @Header('Cache-Control', 'no-store')
  async checkOut(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.update');
    const group = await this.ownedGroup(user.id, id);
    return this.attendance('POST', '/api/v1/internal/teacher-sessions/check-out', await this.punch(group, user.id));
  }

  @Post('groups/:id/roster')
  @Header('Cache-Control', 'no-store')
  async roster(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.read');
    return this.records('POST', '/api/v1/internal/student-records/roster', await this.groupRecords(id, user.id));
  }

  @Post('groups/:id/attendance')
  @Header('Cache-Control', 'no-store')
  async saveAttendance(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AttendanceBody) {
    const user = await this.authorize(request, 'teaching.update');
    return this.records('POST', '/api/v1/internal/student-records/attendance', { ...(await this.groupRecords(id, user.id)), rows: dto.rows });
  }

  @Post('groups/:id/attendance/history')
  @Header('Cache-Control', 'no-store')
  async attendanceHistory(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.read');
    return this.records('POST', '/api/v1/internal/student-records/attendance/history', await this.groupRecords(id, user.id));
  }

  @Post('groups/:id/absences/justify')
  @Header('Cache-Control', 'no-store')
  async justifyAbsence(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: JustificationDto) {
    const user = await this.authorize(request, 'teaching.update');
    return this.records('POST', '/api/v1/internal/student-records/absences/teacher-justify', { ...(await this.groupRecords(id, user.id)), attendanceId: dto.attendanceId, actorId: user.id, reason: dto.reason, ...(dto.file ? { file: dto.file } : {}) });
  }

  @Post('groups/:id/grades')
  @Header('Cache-Control', 'no-store')
  async grades(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GradesBody) {
    const user = await this.authorize(request, 'teaching.update');
    return this.records('POST', '/api/v1/internal/student-records/grades', { ...(await this.groupRecords(id, user.id)), rows: dto.rows });
  }

  @Post('groups/:id/grades/view')
  @Header('Cache-Control', 'no-store')
  async viewGrades(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'teaching.read');
    return this.records('POST', '/api/v1/internal/student-records/grades/view', await this.groupRecords(id, user.id));
  }

  private async ownedGroup(teacherUserId: string, groupId: string): Promise<Record<string, unknown>> {
    const body = await this.academic('GET', `/api/v1/internal/teaching/groups?teacherUserId=${teacherUserId}`);
    const groups = isRecord(body) && Array.isArray(body['groups']) ? body['groups'] : [];
    const group = groups.find((item) => isRecord(item) && item['id'] === groupId);
    if (!group || !isRecord(group)) throw new HttpException('Ese grupo no está asignado a este docente.', 404);
    return group;
  }

  private async groupRecords(groupId: string, teacherUserId: string) {
    const group = await this.ownedGroup(teacherUserId, groupId);
    const enrolled = await this.forward('GET', process.env.ENROLLMENT_UPSTREAM ?? 'http://enrollment:3004', `/api/v1/internal/enrollment?groupId=${groupId}`);
    const rows = isRecord(enrolled) && Array.isArray(enrolled['enrollments']) ? enrolled['enrollments'] : [];
    const students = await Promise.all(rows.filter(isRecord).flatMap((row) => typeof row['studentUserId'] === 'string' ? [row['studentUserId']] : []).map(async (userId) => {
      const profile = await this.profiles.get(userId);
      return { userId, code: profile.documentNumber, documentNumber: profile.documentNumber, name: `${profile.firstName} ${profile.paternalLastName} ${profile.maternalLastName}`.trim() };
    }));
    return { id: group['id'], code: group['code'], language: group['language'], level: group['level'], status: group['status'], startsAt: group['startsAt'], endsAt: group['endsAt'], teacherUserId, students };
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private async punch(group: Record<string, unknown>, teacherUserId: string) {
    const profile = await this.profiles.get(teacherUserId);
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
      teacherName: `${profile.firstName} ${profile.paternalLastName} ${profile.maternalLastName}`.trim(),
      teacherDocument: profile.documentNumber,
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

  private records(method: string, path: string, body?: unknown) {
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
