import { Body, Controller, Get, Header, Injectable, Post, Query, ParseUUIDPipe, UnauthorizedException, UseGuards, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

import { EnrollmentService } from '../../application/enrollment.service.js';

@Injectable()
export class InternalEnrollmentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.SITES_INTERNAL_SECRET;
    const supplied = context.switchToHttp().getRequest<FastifyRequest>().headers['x-internal-secret'];
    if (!secret || secret.length < 32 || typeof supplied !== 'string') throw new UnauthorizedException();
    const a = Buffer.from(secret); const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}

class EnrollDto {
  @IsUUID('all')
  studentUserId!: string;

  @IsUUID('all')
  groupId!: string;

  @IsString()
  @MaxLength(16)
  groupCode!: string;

  @IsString()
  @MaxLength(80)
  language!: string;

  @IsString()
  @MaxLength(80)
  level!: string;

  @IsString()
  @MaxLength(80)
  modality!: string;

  @IsString()
  @MaxLength(80)
  studyType!: string;

  @IsString()
  @MaxLength(240)
  schedule!: string;

  @IsString()
  @MaxLength(200)
  teacherName!: string;

  @IsString()
  @MaxLength(255)
  meetUrl!: string;

  @IsString()
  @MaxLength(40)
  startsAt!: string;

  @IsString()
  @MaxLength(40)
  endsAt!: string;

  @IsUUID('all')
  paymentId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxStudents!: number;
}

class WaitDto {
  @IsUUID('all')
  studentUserId!: string;

  @IsUUID('all')
  groupId!: string;

  @IsString()
  @MaxLength(16)
  groupCode!: string;

  @IsString()
  @MaxLength(80)
  language!: string;

  @IsString()
  @MaxLength(240)
  schedule!: string;
}

class ExamDto {
  @IsUUID('all')
  studentUserId!: string;

  @IsString()
  @MaxLength(80)
  language!: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID('all')
  examGroupId!: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(40)
  examDate!: string | null;

  @IsString()
  @MaxLength(80)
  modality!: string;

  @IsString()
  @MaxLength(255)
  meetUrl!: string;

  @IsUUID('all')
  paymentId!: string;
}

@Controller('internal/enrollment')
@UseGuards(InternalEnrollmentGuard)
export class EnrollmentController {
  constructor(private readonly enrollments: EnrollmentService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query('studentUserId', ParseUUIDPipe) studentUserId: string) {
    return this.enrollments.list(studentUserId);
  }

  @Get('counts')
  @Header('Cache-Control', 'no-store')
  counts() {
    return this.enrollments.counts();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  enroll(@Body() dto: EnrollDto) {
    return this.enrollments.enroll(dto);
  }

  @Post('wait')
  @Header('Cache-Control', 'no-store')
  wait(@Body() dto: WaitDto) {
    return this.enrollments.wait(dto);
  }

  @Get('exams')
  @Header('Cache-Control', 'no-store')
  listExams(@Query('studentUserId', ParseUUIDPipe) studentUserId: string) {
    return this.enrollments.listExams(studentUserId);
  }

  @Post('exams')
  @Header('Cache-Control', 'no-store')
  registerExam(@Body() dto: ExamDto) {
    return this.enrollments.registerExam({
      ...dto,
      examGroupId: dto.examGroupId ?? null,
      examDate: dto.examDate ?? null,
    });
  }
}
