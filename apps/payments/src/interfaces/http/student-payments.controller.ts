import { Body, Controller, Get, Header, Post, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

import { StudentPaymentsService } from '../../application/student-payments.service.js';
import { InternalPaymentsGuard } from './payment-catalog.controller.js';

class CreateStudentPaymentDto {
  @IsUUID('all')
  studentUserId!: string;

  @IsString()
  @MaxLength(200)
  studentName!: string;

  @IsIn(['ENROLLMENT', 'PROFICIENCY'])
  concept!: 'ENROLLMENT' | 'PROFICIENCY';

  @IsString()
  @MaxLength(240)
  detail!: string;

  @IsString()
  @MaxLength(32)
  tariffCode!: string;
}

@Controller('internal/payments/students')
@UseGuards(InternalPaymentsGuard)
export class StudentPaymentsController {
  constructor(private readonly payments: StudentPaymentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query('studentUserId', ParseUUIDPipe) studentUserId: string) {
    return this.payments.list(studentUserId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateStudentPaymentDto) {
    return this.payments.create(dto);
  }
}
