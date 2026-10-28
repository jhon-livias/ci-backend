import { Controller, Get, Header, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { AcademicGroupsService } from '../../application/academic-groups.service.js';
import { InternalSitesGuard } from './sites.controller.js';

@Controller('internal/teaching')
@UseGuards(InternalSitesGuard)
export class TeachingController {
  constructor(private readonly groups: AcademicGroupsService) {}

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  list(@Query('teacherUserId', ParseUUIDPipe) teacherUserId: string) {
    return this.groups.listForTeacher(teacherUserId);
  }
}
