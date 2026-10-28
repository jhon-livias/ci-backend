import { Body, Controller, ForbiddenException, Get, Header, HttpException, Param, ParseUUIDPipe, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Equals, IsBoolean, IsString, IsUUID, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';

import { AccountProfileService } from '../../application/account-profile.service.js';
import { AuthenticationService } from '../../application/authentication.service.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';
import { nextOfferedLevel, type EnrollmentProgressStatus } from '../../../../../libs/contracts/src/enrollment-level.js';
import { limaCalendar } from '../../../../../libs/contracts/src/lima-calendar.js';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

class LanguageQueryDto {
  @IsString()
  @MaxLength(80)
  language!: string;
}

class EnrollBodyDto {
  @IsUUID('all')
  groupId!: string;

  @IsBoolean()
  @Equals(true)
  acceptedTerms!: true;
}

class ExamBodyDto {
  @IsString()
  @MaxLength(80)
  language!: string;

  @IsBoolean()
  @Equals(true)
  acceptedTerms!: true;
}

const asStatus = (value: unknown): EnrollmentProgressStatus | null => {
  if (value === 'PENDING_PAYMENT' || value === 'ACTIVE' || value === 'APPROVED' || value === 'FAILED' || value === 'WITHDRAWN') return value;
  return null;
};

@Controller('auth/student')
export class StudentPortalController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly profiles: AccountProfileService,
  ) {}

  @Get('workspace')
  @Header('Cache-Control', 'no-store')
  async workspace(@Req() request: FastifyRequest) {
    const user = await this.authorize(request, 'enrollment.read');
    const [student, catalog, enrollments, payments, exams, offerings] = await Promise.all([
      this.students('GET', `/api/v1/internal/students/me?userId=${user.id}`),
      this.academic('GET', '/api/v1/internal/student/catalog'),
      this.enrollment('GET', `/api/v1/internal/enrollment?studentUserId=${user.id}`),
      this.payments('GET', `/api/v1/internal/payments/students?studentUserId=${user.id}`),
      this.enrollment('GET', `/api/v1/internal/enrollment/exams?studentUserId=${user.id}`),
      this.academic('GET', '/api/v1/internal/student/groups'),
    ]);
    const today = limaCalendar();
    const groups = this.rows(offerings, 'groups');
    const history = this.rows(enrollments, 'enrollments');
    const nextClasses = history.flatMap((item) => {
      if (item['status'] !== 'ACTIVE') return [];
      const group = groups.find((row) => row['id'] === item['groupId']);
      const start = typeof item['startsAt'] === 'string' ? item['startsAt'].slice(0, 10) : '';
      const end = typeof item['endsAt'] === 'string' ? item['endsAt'].slice(0, 10) : '';
      if (today.date < start || today.date > end) return [];
      const slots = Array.isArray(group?.['slots']) ? group['slots'] : [];
      const todaySlot = slots.find((slot) => isRecord(slot) && slot['day'] === today.day);
      if (!todaySlot) return [];
      return [{
        groupId: item['groupId'],
        code: item['groupCode'],
        language: item['language'],
        level: item['level'],
        schedule: item['schedule'],
        meetUrl: item['meetUrl'],
        startsAt: item['startsAt'],
      }];
    });
    return {
      student,
      catalog,
      enrollments: history,
      payments: this.rows(payments, 'payments'),
      exams: this.rows(exams, 'exams'),
      nextClasses,
    };
  }

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  async groups(@Req() request: FastifyRequest, @Query() query: LanguageQueryDto) {
    const user = await this.authorize(request, 'enrollment.read');
    const language = query.language.trim();
    if (!/^[^<>]{1,80}$/u.test(language)) throw new HttpException('Selecciona un idioma.', 400);
    const [catalog, offerings, countsBody, enrollments, tariffs] = await Promise.all([
      this.academic('GET', '/api/v1/internal/student/catalog'),
      this.academic('GET', `/api/v1/internal/student/groups?language=${encodeURIComponent(language)}`),
      this.enrollment('GET', '/api/v1/internal/enrollment/counts'),
      this.enrollment('GET', `/api/v1/internal/enrollment?studentUserId=${user.id}`),
      this.payments('GET', '/api/v1/internal/payments'),
    ]);
    const levels = isRecord(catalog) && Array.isArray(catalog['levels']) ? catalog['levels'].filter((item): item is string => typeof item === 'string') : [];
    const maxStudents = isRecord(catalog) && typeof catalog['maxStudents'] === 'number' ? catalog['maxStudents'] : 0;
    const minStudents = isRecord(catalog) && typeof catalog['minStudents'] === 'number' ? catalog['minStudents'] : 0;
    const last = this.rows(enrollments, 'enrollments').find((item) => item['language'] === language) ?? null;
    const lastStatus = last ? asStatus(last['status']) : null;
    const offer = nextOfferedLevel(levels, last && lastStatus && typeof last['level'] === 'string' ? { level: last['level'], status: lastStatus } : null);
    const occupancy = new Map(this.rows(countsBody, 'counts').flatMap((item) => {
      if (typeof item['groupId'] !== 'string' || typeof item['enrolled'] !== 'number') return [];
      return [[item['groupId'], item['enrolled']] as const];
    }));
    const tariffRows = isRecord(tariffs) && Array.isArray(tariffs['tariffs']) ? tariffs['tariffs'] : [];
    const groups = this.rows(offerings, 'groups').flatMap((group) => {
      if (group['level'] !== offer.level) return [];
      const enrolled = occupancy.get(String(group['id'])) ?? 0;
      const full = maxStudents > 0 && enrolled >= maxStudents;
      const studyType = typeof group['studyType'] === 'string' ? group['studyType'] : '';
      const tariffCode = /intens/iu.test(studyType) ? 'INTENSIVE' : 'REGULAR';
      const tariff = tariffRows.find((item) => isRecord(item) && item['code'] === tariffCode);
      return [{
        ...group,
        enrolledCount: enrolled,
        availability: full ? 'Lleno' : 'Disponible',
        amount: isRecord(tariff) && typeof tariff['amount'] === 'string' ? tariff['amount'] : null,
        tariffCode,
      }];
    });
    return { last, nextLevel: offer.level, blocked: offer.blocked, minStudents, maxStudents, groups };
  }

  @Post('enroll')
  @Header('Cache-Control', 'no-store')
  async enroll(@Req() request: FastifyRequest, @Body() dto: EnrollBodyDto) {
    const user = await this.authorize(request, 'enrollment.update');
    const profile = await this.profiles.get(user.id);
    const catalog = await this.academic('GET', '/api/v1/internal/student/catalog') as Record<string, unknown>;
    const maxStudents = typeof catalog['maxStudents'] === 'number' ? catalog['maxStudents'] : 0;
    const snapshot = await this.findGroup(dto.groupId);
    const language = typeof snapshot['language'] === 'string' ? snapshot['language'] : '';
    const preview = await this.groupPreview(user.id, language);
    if (preview.blocked) throw new HttpException('Ya tienes una matrícula en curso para este idioma.', 409);
    if (preview.level !== snapshot['level']) throw new HttpException('Ese grupo no corresponde al nivel que te toca.', 409);
    const studyType = typeof snapshot['studyType'] === 'string' ? snapshot['studyType'] : '';
    const payment = await this.payments('POST', '/api/v1/internal/payments/students', {
      studentUserId: user.id,
      studentName: `${profile.firstName} ${profile.paternalLastName}`.trim(),
      concept: 'ENROLLMENT',
      detail: `${snapshot['language']} ${snapshot['level']} · ${snapshot['code']}`,
      tariffCode: /intens/iu.test(studyType) ? 'INTENSIVE' : 'REGULAR',
    });
    if (!isRecord(payment) || typeof payment['id'] !== 'string') throw new ServiceUnavailableException();
    const enrollment = await this.enrollment('POST', '/api/v1/internal/enrollment', {
      studentUserId: user.id,
      groupId: snapshot['id'],
      groupCode: snapshot['code'],
      language: snapshot['language'],
      level: snapshot['level'],
      modality: snapshot['modality'],
      studyType: snapshot['studyType'],
      schedule: snapshot['schedule'],
      teacherName: snapshot['teacherName'],
      meetUrl: snapshot['meetUrl'] ?? '',
      startsAt: snapshot['startsAt'],
      endsAt: snapshot['endsAt'],
      paymentId: payment['id'],
      maxStudents,
    });
    return { enrollment, payment, notice: 'Se registró la solicitud. El cobro queda pendiente de la pasarela de pago.' };
  }

  @Post('groups/:id/wait')
  @Header('Cache-Control', 'no-store')
  async wait(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const user = await this.authorize(request, 'enrollment.update');
    const snapshot = await this.findGroup(id);
    return this.enrollment('POST', '/api/v1/internal/enrollment/wait', {
      studentUserId: user.id,
      groupId: snapshot['id'],
      groupCode: snapshot['code'],
      language: snapshot['language'],
      schedule: snapshot['schedule'],
    });
  }

  @Get('exams')
  @Header('Cache-Control', 'no-store')
  async exams(@Req() request: FastifyRequest, @Query('language') languageQuery?: string) {
    await this.authorize(request, 'enrollment.read');
    const language = typeof languageQuery === 'string' ? languageQuery.trim() : '';
    const path = language ? `/api/v1/internal/student/proficiency?language=${encodeURIComponent(language)}` : '/api/v1/internal/student/proficiency';
    const [groups, catalog] = await Promise.all([
      this.academic('GET', path),
      this.payments('GET', '/api/v1/internal/payments'),
    ]);
    const today = limaCalendar().date;
    const upcoming = this.rows(groups, 'groups').find((item) => typeof item['startsAt'] === 'string' && item['startsAt'].slice(0, 10) >= today) ?? null;
    const tariff = this.rows(catalog, 'tariffs').find((item) => item['code'] === 'PROFICIENCY') ?? null;
    return { upcoming, amount: isRecord(tariff) ? tariff['amount'] : null };
  }

  @Post('exams')
  @Header('Cache-Control', 'no-store')
  async registerExam(@Req() request: FastifyRequest, @Body() dto: ExamBodyDto) {
    const user = await this.authorize(request, 'enrollment.update');
    const language = dto.language.trim();
    if (!/^[^<>]{1,80}$/u.test(language)) throw new HttpException('Selecciona un idioma.', 400);
    const profile = await this.profiles.get(user.id);
    const dates = await this.academic('GET', `/api/v1/internal/student/proficiency?language=${encodeURIComponent(language)}`);
    const today = limaCalendar().date;
    const upcoming = this.rows(dates, 'groups').find((item) => typeof item['startsAt'] === 'string' && item['startsAt'].slice(0, 10) >= today) ?? null;
    const payment = await this.payments('POST', '/api/v1/internal/payments/students', {
      studentUserId: user.id,
      studentName: `${profile.firstName} ${profile.paternalLastName}`.trim(),
      concept: 'PROFICIENCY',
      detail: `Examen de suficiencia · ${language}`,
      tariffCode: 'PROFICIENCY',
    });
    if (!isRecord(payment) || typeof payment['id'] !== 'string') throw new ServiceUnavailableException();
    const exam = await this.enrollment('POST', '/api/v1/internal/enrollment/exams', {
      studentUserId: user.id,
      language,
      examGroupId: typeof upcoming?.['id'] === 'string' ? upcoming['id'] : null,
      examDate: typeof upcoming?.['startsAt'] === 'string' ? upcoming['startsAt'] : null,
      modality: typeof upcoming?.['modality'] === 'string' ? upcoming['modality'] : 'Virtual',
      meetUrl: typeof upcoming?.['meetUrl'] === 'string' ? upcoming['meetUrl'] : '',
      paymentId: payment['id'],
    });
    return {
      exam,
      payment,
      student: { documentNumber: profile.documentNumber, name: `${profile.firstName} ${profile.paternalLastName} ${profile.maternalLastName}`.trim() },
      notice: 'Se registró la solicitud. El cobro queda pendiente de la pasarela de pago.',
    };
  }

  private async groupPreview(studentUserId: string, language: string) {
    const [catalog, enrollments] = await Promise.all([
      this.academic('GET', '/api/v1/internal/student/catalog'),
      this.enrollment('GET', `/api/v1/internal/enrollment?studentUserId=${studentUserId}`),
    ]);
    const levels = isRecord(catalog) && Array.isArray(catalog['levels']) ? catalog['levels'].filter((item): item is string => typeof item === 'string') : [];
    const last = this.rows(enrollments, 'enrollments').find((item) => item['language'] === language) ?? null;
    const lastStatus = last ? asStatus(last['status']) : null;
    return nextOfferedLevel(levels, last && lastStatus && typeof last['level'] === 'string' ? { level: last['level'], status: lastStatus } : null);
  }

  private async findGroup(id: string): Promise<Record<string, unknown>> {
    const body = await this.academic('GET', '/api/v1/internal/student/groups');
    const group = this.rows(body, 'groups').find((item) => item['id'] === id);
    if (!group) throw new HttpException('Ese grupo no está disponible para matrícula.', 404);
    return group;
  }

  private rows(body: unknown, key: string): Record<string, unknown>[] {
    if (!isRecord(body) || !Array.isArray(body[key])) return [];
    return body[key].filter(isRecord);
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private students(method: string, path: string) {
    return this.forward(method, process.env.STUDENTS_UPSTREAM ?? 'http://students:3003', path);
  }

  private academic(method: string, path: string) {
    return this.forward(method, process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002', path);
  }

  private enrollment(method: string, path: string, body?: unknown) {
    return this.forward(method, process.env.ENROLLMENT_UPSTREAM ?? 'http://enrollment:3004', path, body);
  }

  private payments(method: string, path: string, body?: unknown) {
    return this.forward(method, process.env.PAYMENTS_UPSTREAM ?? 'http://payments:3007', path, body);
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
