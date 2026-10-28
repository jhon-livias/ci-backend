import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, HttpCode, HttpException, Param, ParseUUIDPipe, Patch, Post, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';

import { AuthenticationService } from '../../application/authentication.service.js';
import { UserDirectoryService } from '../../application/user-directory.service.js';
import { UserAccountRuleError } from '../../domain/user-account.js';
import { hasAccessPermission, type AccessPermission } from '../../domain/access-policy.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

class SaveTeacherDto {
  @Transform(trim)
  @IsString()
  @Matches(/^[^<>]{1,100}$/u)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^[^<>]{1,100}$/u)
  lastNames!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\d{8}$/u)
  documentNumber!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\d{6,15}$/u)
  phone!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(120)
  @Matches(/^[^<>]{0,120}$/u)
  academicDegree!: string;
}

@Controller('auth/director/teachers')
export class DirectorTeachersController {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly users: UserDirectoryService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Req() request: FastifyRequest) {
    await this.authorize(request, 'teachers.read');
    const [accounts, profiles] = await Promise.all([this.users.listTeachers(), this.profiles()]);
    const degree = new Map(profiles.map((row) => [row.userId, row.academicDegree]));
    return {
      teachers: accounts.map((account) => ({
        id: account.id,
        documentNumber: account.documentNumber,
        firstName: account.firstName,
        lastNames: `${account.paternalLastName} ${account.maternalLastName}`.trim(),
        phone: account.mobile || account.phone,
        email: account.email,
        academicDegree: degree.get(account.id) ?? '',
      })),
    };
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@Req() request: FastifyRequest, @Body() dto: SaveTeacherDto) {
    const actor = await this.authorize(request, 'teachers.create');
    const names = this.split(dto.lastNames);
    const siteId = await this.firstSite();
    try {
      const created = await this.users.createTeacher({
        firstName: dto.firstName,
        paternalLastName: names.paternal,
        maternalLastName: names.maternal,
        documentNumber: dto.documentNumber,
        email: dto.email,
        mobile: dto.phone,
        phone: dto.phone,
        siteId,
      }, actor.id);
      await this.saveDegree(created.id, dto.academicDegree);
      return { ...created, academicDegree: dto.academicDegree, lastNames: dto.lastNames };
    } catch (error) {
      if (error instanceof UserAccountRuleError) throw new BadRequestException(error.message === 'email' ? 'Solo se acepta el dominio @uprit.edu.pe.' : 'Revisa los datos del docente.');
      throw error;
    }
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  async update(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveTeacherDto) {
    const actor = await this.authorize(request, 'teachers.update');
    const current = await this.users.get(id);
    const names = this.split(dto.lastNames);
    await this.users.update(id, {
      documentType: current.documentType,
      documentNumber: dto.documentNumber,
      firstName: dto.firstName,
      paternalLastName: names.paternal,
      maternalLastName: names.maternal,
      siteId: current.siteId,
      phone: dto.phone,
      mobileCountry: current.mobileCountry || '+51',
      mobile: dto.phone,
      email: dto.email,
      enabled: true,
      grants: [],
    }, actor.id);
    await this.saveDegree(id, dto.academicDegree);
    return { id };
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async remove(@Req() request: FastifyRequest, @Param('id', ParseUUIDPipe) id: string) {
    const actor = await this.authorize(request, 'teachers.delete');
    await this.users.remove(id, actor.id);
  }

  private split(value: string) {
    const parts = value.trim().split(/\s+/u);
    return { paternal: parts[0] ?? value, maternal: parts.slice(1).join(' ') || '-' };
  }

  private async firstSite(): Promise<string> {
    const sites = await this.academic('GET', '/api/v1/internal/sites');
    const list = isRecord(sites) && Array.isArray(sites['sites']) ? sites['sites'] : Array.isArray(sites) ? sites : [];
    const first = list.find((item) => isRecord(item) && item['active'] !== false && typeof item['id'] === 'string');
    if (!first || typeof first['id'] !== 'string') throw new BadRequestException('No hay una sede para asignar al docente.');
    return first['id'];
  }

  private async profiles(): Promise<readonly { userId: string; academicDegree: string }[]> {
    const body = await this.academic('GET', '/api/v1/internal/director/teacher-profiles');
    const rows = isRecord(body) && Array.isArray(body['profiles']) ? body['profiles'] : [];
    return rows.flatMap((row) => {
      if (!isRecord(row) || typeof row['userId'] !== 'string') return [];
      return [{ userId: row['userId'], academicDegree: typeof row['academicDegree'] === 'string' ? row['academicDegree'] : '' }];
    });
  }

  private async saveDegree(userId: string, academicDegree: string) {
    await this.academic('POST', '/api/v1/internal/director/teacher-profiles', { userId, academicDegree });
  }

  private async authorize(request: FastifyRequest, permission: AccessPermission) {
    const token = request.cookies?.['ci_access'];
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.restore(token);
    if (!hasAccessPermission(session.user.roles, permission)) throw new ForbiddenException();
    if (request.method !== 'GET' && request.headers['x-csrf-token'] !== session.csrfToken) throw new ForbiddenException();
    return session.user;
  }

  private async academic(method: string, path: string, body?: unknown): Promise<unknown> {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const upstream = process.env.ACADEMIC_UPSTREAM ?? 'http://academic:3002';
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
      if ([400, 404, 409].includes(response.status)) throw new HttpException('No se pudo completar la operación.', response.status);
      throw new ServiceUnavailableException();
    }
    return response.status === 204 ? undefined : await response.json();
  }
}
