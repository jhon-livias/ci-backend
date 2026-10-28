import { Body, Controller, Get, Header, Param, Post, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { CLASS_KINDS, WEEK_DAYS } from '../../../../../libs/contracts/src/schedule-combo.js';
import { TeacherSessionsService } from '../../application/teacher-sessions.service.js';
import { InternalAttendanceGuard } from './follow-up.controller.js';

class SlotDto {
  @IsIn(WEEK_DAYS)
  day!: (typeof WEEK_DAYS)[number];

  @IsIn(CLASS_KINDS)
  classKind!: (typeof CLASS_KINDS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinutes!: number;
}

class PunchDto {
  @IsUUID('all')
  id!: string;

  @IsString()
  @Matches(/^[GSgs]\d{1,3}$/u)
  code!: string;

  @IsString()
  @MaxLength(80)
  language!: string;

  @IsString()
  @MaxLength(80)
  level!: string;

  @IsIn(['CREATED', 'RESCHEDULED', 'OPENED', 'COMPLETED'])
  status!: 'CREATED' | 'RESCHEDULED' | 'OPENED' | 'COMPLETED';

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsUUID('all')
  teacherUserId!: string;

  @IsString() @MaxLength(200)
  teacherName!: string;

  @IsString() @MaxLength(16)
  teacherDocument!: string;

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
class FileDto { @IsString() @MaxLength(160) name!: string; @IsString() @MaxLength(100) contentType!: string; @IsString() @MaxLength(7000000) base64!: string; }
class TeacherJustifyDto extends PunchDto { @IsUUID('all') sessionId!: string; @IsString() @MaxLength(500) reason!: string; @ValidateNested() @Type(() => FileDto) file!: FileDto; }

@Controller('internal/teacher-sessions')
@UseGuards(InternalAttendanceGuard)
export class TeacherSessionsController {
  constructor(private readonly sessions: TeacherSessionsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query('groupId', ParseUUIDPipe) groupId: string, @Query('teacherUserId', ParseUUIDPipe) teacherUserId: string) {
    return this.sessions.list(groupId, teacherUserId);
  }
  @Get('absences') @Header('Cache-Control', 'no-store') allAbsences(@Query('query') query?: string, @Query('date') date?: string, @Query('status') status?: string) { return this.sessions.allAbsences({ query, date, status }); }
  @Get('absences/:teacherAbsenceId/attachment') @Header('Cache-Control', 'no-store') attachment(@Param('teacherAbsenceId', ParseUUIDPipe) teacherAbsenceId: string) { return this.sessions.attachment(teacherAbsenceId); }

  @Post('synchronize')
  synchronize(@Body() dto: PunchDto) { return this.sessions.synchronizePastSessions(dto, dto.teacherUserId); }

  @Post('check-in')
  @Header('Cache-Control', 'no-store')
  checkIn(@Body() dto: PunchDto) {
    return this.sessions.checkIn(dto, dto.teacherUserId);
  }

  @Post('check-out')
  @Header('Cache-Control', 'no-store')
  checkOut(@Body() dto: PunchDto) {
    return this.sessions.checkOut(dto, dto.teacherUserId);
  }
  @Post('absences') @Header('Cache-Control', 'no-store') absences(@Body() dto: PunchDto) { return this.sessions.absences(dto, dto.teacherUserId); }
  @Post('absences/justify') @Header('Cache-Control', 'no-store') justify(@Body() dto: TeacherJustifyDto) { return this.sessions.justifyAbsence(dto, dto.teacherUserId, dto.sessionId, dto.reason, dto.file); }
}
