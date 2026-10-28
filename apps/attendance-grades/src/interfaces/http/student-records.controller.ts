import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
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

@Controller('internal/student-records')
@UseGuards(InternalAttendanceGuard)
export class StudentRecordsController {
  constructor(private readonly records: StudentRecordsService) {}
  @Post('roster') @Header('Cache-Control', 'no-store') roster(@Body() dto: RecordsBody) { return this.records.roster(dto, dto.teacherUserId, dto.students); }
  @Post('attendance/history') @Header('Cache-Control', 'no-store') history(@Body() dto: RecordsBody) { return this.records.attendanceHistory(dto, dto.teacherUserId); }
  @Post('attendance') @Header('Cache-Control', 'no-store') attendance(@Body() dto: AttendanceBody) { return this.records.saveAttendance(dto, dto.teacherUserId, dto.students, dto.rows); }
  @Post('grades') @Header('Cache-Control', 'no-store') grades(@Body() dto: GradesBody) { return this.records.saveGrades(dto, dto.teacherUserId, dto.students, dto.rows); }
  @Post('grades/view') @Header('Cache-Control', 'no-store') viewGrades(@Body() dto: RecordsBody) { return this.records.grades(dto, dto.teacherUserId, dto.students); }
}
