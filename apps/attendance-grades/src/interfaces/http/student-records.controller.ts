import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { StudentRecordsService } from '../../application/student-records.service.js';
import { InternalAttendanceGuard } from './follow-up.controller.js';

class GroupDto {
  @IsUUID('all') id!: string;
  @IsString() @MaxLength(16) code!: string;
  @IsString() @MaxLength(80) language!: string;
  @IsString() @MaxLength(80) level!: string;
  @IsIn(['CREATED', 'RESCHEDULED', 'OPENED', 'COMPLETED']) status!: string;
  @IsString() @MaxLength(40) startsAt!: string;
  @IsString() @MaxLength(40) endsAt!: string;
  @IsUUID('all') teacherUserId!: string;
}
class StudentDto {
  @IsUUID('all') userId!: string;
  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(16) documentNumber!: string;
  @IsString() @MaxLength(200) name!: string;
}
class AttendanceDto { @IsUUID('all') studentUserId!: string; @IsIn(['PRESENT', 'ABSENT', 'JUSTIFIED_ABSENCE', 'LATE']) status!: 'PRESENT' | 'ABSENT' | 'JUSTIFIED_ABSENCE' | 'LATE'; }
class GradeDto {
  @IsUUID('all') studentUserId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(20) listeningReading!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) writing!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) testOne!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) participation!: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(20) finalTest!: number | null;
}
class RecordsBody extends GroupDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => StudentDto) students!: StudentDto[];
}
class AttendanceBody extends RecordsBody { @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => AttendanceDto) rows!: AttendanceDto[]; }
class GradesBody extends RecordsBody { @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => GradeDto) rows!: GradeDto[]; }
class AttachmentDto { @IsString() @MaxLength(160) name!: string; @IsString() @MaxLength(100) contentType!: string; @IsString() @MaxLength(7000000) base64!: string; }
class JustifyDto { @IsUUID('all') attendanceId!: string; @IsUUID('all') actorId!: string; @IsString() @MaxLength(500) reason!: string; @IsOptional() @ValidateNested() @Type(() => AttachmentDto) file?: AttachmentDto; }

@Controller('internal/student-records')
@UseGuards(InternalAttendanceGuard)
export class StudentRecordsController {
  constructor(private readonly records: StudentRecordsService) {}
  @Get('absences') @Header('Cache-Control', 'no-store') absences(@Query('query') query?: string, @Query('date') date?: string, @Query('status') status?: string, @Query('groupId') groupId?: string) { return this.records.listAbsences({ query, date, status, groupId }); }
  @Post('absences/justify') @Header('Cache-Control', 'no-store') justify(@Body() dto: JustifyDto) { return this.records.justifyStudent(dto.attendanceId, dto.actorId, dto.reason, dto.file); }
  @Post('absences/teacher-justify') @Header('Cache-Control', 'no-store') teacherJustify(@Body() dto: JustifyDto & RecordsBody) { return this.records.justifyStudentForGroup(dto.attendanceId, dto, dto.actorId, dto.reason, dto.file); }
  @Post('roster') @Header('Cache-Control', 'no-store') roster(@Body() dto: RecordsBody) { return this.records.roster(dto, dto.teacherUserId, dto.students); }
  @Post('attendance/history') @Header('Cache-Control', 'no-store') history(@Body() dto: RecordsBody) { return this.records.attendanceHistory(dto, dto.teacherUserId); }
  @Post('attendance') @Header('Cache-Control', 'no-store') attendance(@Body() dto: AttendanceBody) { return this.records.saveAttendance(dto, dto.teacherUserId, dto.students, dto.rows); }
  @Post('grades') @Header('Cache-Control', 'no-store') grades(@Body() dto: GradesBody) { return this.records.saveGrades(dto, dto.teacherUserId, dto.students, dto.rows); }
  @Post('grades/view') @Header('Cache-Control', 'no-store') viewGrades(@Body() dto: RecordsBody) { return this.records.grades(dto, dto.teacherUserId, dto.students); }
}
