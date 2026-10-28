import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { AcademicConfigService } from '../../application/academic-config.service.js';
import { AcademicGroupsService } from '../../application/academic-groups.service.js';
import { InternalSitesGuard } from './sites.controller.js';

class LanguageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  language?: string;
}

@Controller('internal/student')
@UseGuards(InternalSitesGuard)
export class StudentOfferingsController {
  constructor(
    private readonly groups: AcademicGroupsService,
    private readonly config: AcademicConfigService,
  ) {}

  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  catalog() {
    return this.config.studentCatalog();
  }

  @Get('groups')
  @Header('Cache-Control', 'no-store')
  offerings(@Query() query: LanguageQueryDto) {
    return this.groups.listOfferings(query.language?.trim() || undefined);
  }

  @Get('proficiency')
  @Header('Cache-Control', 'no-store')
  proficiency(@Query() query: LanguageQueryDto) {
    return this.groups.listProficiency(query.language?.trim() || undefined);
  }
}
