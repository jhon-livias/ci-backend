import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { TicketsService } from '../../application/tickets.service.js';
import { ChangeTicketStatusDto, CreateExternalTicketDto, CreateInternalTicketDto, ReopenTicketDto } from './dto/ticket.dto.js';
import { CurrentTicketsActor, TicketsRolesGuard, TicketsSessionGuard, type TicketsActor } from './tickets-session.js';

@Controller('tickets')
@UseGuards(TicketsSessionGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentTicketsActor() actor: TicketsActor) {
    return this.tickets.list(actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  create(@CurrentTicketsActor() actor: TicketsActor, @Body() dto: CreateExternalTicketDto) {
    return this.tickets.createExternal(actor, dto);
  }

  @Post('internal')
  @UseGuards(TicketsRolesGuard('area_manager', 'admin'))
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  createInternal(@CurrentTicketsActor() actor: TicketsActor, @Body() dto: CreateInternalTicketDto) {
    return this.tickets.createInternal(actor, dto);
  }

  @Post(':id/reopen')
  @Header('Cache-Control', 'no-store')
  reopen(
    @CurrentTicketsActor() actor: TicketsActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenTicketDto,
  ) {
    return this.tickets.reopen(actor, id, dto.reason);
  }

  @Post(':id/status')
  @UseGuards(TicketsRolesGuard('assistant', 'area_manager', 'admin'))
  @Header('Cache-Control', 'no-store')
  changeStatus(
    @CurrentTicketsActor() actor: TicketsActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTicketStatusDto,
  ) {
    return this.tickets.changeStatus(actor, id, dto);
  }
}
