import { Body, Controller, Get, Header, Post, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}

@Controller('internal/teacher-sessions')
@UseGuards(InternalAttendanceGuard)
export class TeacherSessionsController {
  constructor(private readonly sessions: TeacherSessionsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query('groupId', ParseUUIDPipe) groupId: string, @Query('teacherUserId', ParseUUIDPipe) teacherUserId: string) {
    return this.sessions.list(groupId, teacherUserId);
  }

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
}
