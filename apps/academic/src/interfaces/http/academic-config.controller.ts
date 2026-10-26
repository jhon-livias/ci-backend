import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';

import { AcademicCatalogItemDto, AcademicRulesDto } from '../../../../../libs/contracts/src/academic-config.dto.js';
import { AcademicConfigService } from '../../application/academic-config.service.js';
import { InternalSitesGuard } from './sites.controller.js';

@Controller('internal/academic-config')
@UseGuards(InternalSitesGuard)
export class AcademicConfigController {
  constructor(private readonly config: AcademicConfigService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read() {
    return this.config.read();
  }

  @Post('items')
  @Header('Cache-Control', 'no-store')
  addItem(@Body() dto: AcademicCatalogItemDto) {
    return this.config.addItem(dto.kind, dto.name);
  }

  @Delete('items/:id')
  @Header('Cache-Control', 'no-store')
  removeItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.config.removeItem(id);
  }

  @Put('rules')
  @Header('Cache-Control', 'no-store')
  saveRules(@Body() dto: AcademicRulesDto) {
    return this.config.saveRules(dto);
  }
}
