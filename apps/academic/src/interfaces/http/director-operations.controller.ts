import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { CLASS_KINDS, WEEK_DAYS } from '../../../../../libs/contracts/src/schedule-combo.js';
import { AcademicGroupsService } from '../../application/academic-groups.service.js';
import { ScheduleComboService } from '../../application/schedule-combo.service.js';
import { TeacherProfilesService } from '../../application/teacher-profiles.service.js';
import { InternalSitesGuard } from './sites.controller.js';

class SlotDto {
  @IsIn(WEEK_DAYS)
  day!: (typeof WEEK_DAYS)[number];

  @IsIn(CLASS_KINDS)
  classKind!: (typeof CLASS_KINDS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1380)
  startMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinutes!: number;
}

class CreateComboDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}

class GroupDto {
  @IsString()
  @Matches(/^[GSgs]\d{1,3}$/u)
  code!: string;

  @IsIn(['CLASSES', 'PROFICIENCY'])
  kind!: 'CLASSES' | 'PROFICIENCY';

  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]{1,80}$/u)
  language!: string;

  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]{1,80}$/u)
  level!: string;

  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]{1,80}$/u)
  modality!: string;

  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]{1,80}$/u)
  studyType!: string;

  @IsString()
  @MaxLength(255)
  meetUrl!: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;

  @IsUUID('all')
  teacherUserId!: string;

  @IsString()
  @Matches(/^\d{8}$/u)
  teacherDocument!: string;

  @IsString()
  @MaxLength(200)
  @Matches(/^[^<>]{1,200}$/u)
  teacherName!: string;

  @IsOptional()
  @IsUUID('all')
  dayComboId?: string | null;

  @IsOptional()
  @IsUUID('all')
  hourComboId?: string | null;
}

class RescheduleDto {
  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;
}

class TeacherDegreeDto {
  @IsUUID('all')
  userId!: string;

  @IsString()
  @MaxLength(120)
  academicDegree!: string;
}

@Controller('internal/director')
@UseGuards(InternalSitesGuard)
export class DirectorOperationsController {
  constructor(
    private readonly schedules: ScheduleComboService,
    private readonly groups: AcademicGroupsService,
    private readonly teachers: TeacherProfilesService,
  ) {}

  @Get('schedules')
  @Header('Cache-Control', 'no-store')
  listSchedules() {
    return this.schedules.list();
  }

  @Post('schedules')
  @Header('Cache-Control', 'no-store')
  createSchedule(@Body() dto: CreateComboDto) {
    return this.schedules.create(dto.slots);
  }

  @Delete('schedules/:id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  removeSchedule(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.remove(id);
  }

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  listGroups() {
    return this.groups.list();
  }

  @Post('groups')
  @Header('Cache-Control', 'no-store')
  createGroup(@Body() dto: GroupDto) {
    return this.groups.create({ ...dto, dayComboId: dto.dayComboId ?? null, hourComboId: dto.hourComboId ?? null });
  }

  @Patch('groups/:id')
  @Header('Cache-Control', 'no-store')
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GroupDto) {
    return this.groups.update(id, { ...dto, dayComboId: dto.dayComboId ?? null, hourComboId: dto.hourComboId ?? null });
  }

  @Patch('groups/:id/reschedule')
  @Header('Cache-Control', 'no-store')
  reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDto) {
    return this.groups.reschedule(id, dto.startsAt, dto.endsAt);
  }

  @Get('teacher-profiles')
  @Header('Cache-Control', 'no-store')
  listTeacherProfiles() {
    return this.teachers.list();
  }

  @Post('teacher-profiles')
  @Header('Cache-Control', 'no-store')
  saveTeacherProfile(@Body() dto: TeacherDegreeDto) {
    return this.teachers.upsert(dto.userId, dto.academicDegree);
  }
}
