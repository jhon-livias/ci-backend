import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';

import { CatalogService } from '../../application/catalog.service.js';
import { AddPriorityActivityDto, SaveAreaDto, SaveCategoryDto, SaveMemberDto } from './dto/catalog.dto.js';
import { TicketsRolesGuard, TicketsSessionGuard } from './tickets-session.js';

@Controller('tickets')
@UseGuards(TicketsSessionGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('catalog')
  @Header('Cache-Control', 'no-store')
  snapshot() {
    return this.catalog.snapshot();
  }

  @Post('areas')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  createArea(@Body() dto: SaveAreaDto) {
    return this.catalog.saveArea(null, dto);
  }

  @Put('areas/:id')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  updateArea(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveAreaDto) {
    return this.catalog.saveArea(id, dto);
  }

  @Delete('areas/:id')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  removeArea(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeArea(id);
  }

  @Post('categories')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  createCategory(@Body() dto: SaveCategoryDto) {
    return this.catalog.saveCategory(null, dto);
  }

  @Put('categories/:id')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveCategoryDto) {
    return this.catalog.saveCategory(id, dto);
  }

  @Delete('categories/:id')
  @UseGuards(TicketsRolesGuard('admin'))
  @Header('Cache-Control', 'no-store')
  removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeCategory(id);
  }

  @Post('team')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  createMember(@Body() dto: SaveMemberDto) {
    return this.catalog.saveMember(null, dto);
  }

  @Put('team/:id')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  updateMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveMemberDto) {
    return this.catalog.saveMember(id, dto);
  }

  @Delete('team/:id')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  removeMember(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removeMember(id);
  }

  @Post('priorities/activities')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  addActivity(@Body() dto: AddPriorityActivityDto) {
    return this.catalog.addPriorityActivity(dto);
  }

  @Delete('priorities/activities/:id')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  removeActivity(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.removePriorityActivity(id);
  }
}
