import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { canReopenTicket } from '../domain/reopen-policy.js';
import { statusChangeError } from '../domain/status-transition.js';
import { formatTicketCode, ticketCodePrefix } from '../domain/ticket-code.js';
import { TicketsPrismaService } from '../infrastructure/persistence/tickets-prisma.service.js';
import type { TicketStatus } from '../infrastructure/persistence/generated/client.js';
import type { TicketsActor } from '../interfaces/http/tickets-session.js';
import type { ChangeTicketStatusDto, CreateExternalTicketDto, CreateInternalTicketDto, UpdateInternalTicketDto } from '../interfaces/http/dto/ticket.dto.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: TicketsPrismaService) {}

  async list(actor: TicketsActor) {
    const tickets = await this.prisma.ticket.findMany({
      where: actor.role === 'requester' ? { requesterUserId: actor.id } : {},
      include: { history: { orderBy: { at: 'asc' } }, attachments: true },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map(toTicketView);
  }

  async createExternal(actor: TicketsActor, dto: CreateExternalTicketDto) {
    if (dto.about !== 'self' && ((dto.otherName ?? '').length < 3 || !/^\d{8}$/u.test(dto.otherDocument ?? ''))) {
      throw new BadRequestException('Completa el nombre y el DNI de 8 dígitos de la persona afectada.');
    }
    const area = await this.prisma.area.findUnique({ where: { id: dto.areaId } });
    const category = await this.prisma.ticketCategory.findUnique({ where: { id: dto.categoryId } });
    if (!area || !area.enabled || !area.receivesTickets || !category || !category.enabled || category.areaId !== area.id) {
      throw new BadRequestException('No pudimos registrar el ticket. Revisa el área y la categoría.');
    }
    const now = new Date();
    const aboutLabel = dto.about === 'self'
      ? `Yo mismo/a · ${actor.displayName}`
      : `${dto.about === 'student' ? 'Alumno' : 'Docente'} · ${dto.otherName}`;
    const requesterDocument = actor.documentNumber;
    const affectedDocument = dto.about === 'self' ? '' : (dto.otherDocument ?? '');
    const priority = await this.priorityFor(category.name);
    return this.createTicket({
      kind: 'EXTERNAL',
      actor,
      actorArea: 'Solicitante',
      requesterRole: 'Solicitante',
      areaId: area.id,
      categoryId: category.id,
      categoryName: category.name,
      destinationAreaCode: area.code,
      about: dto.about === 'self' ? 'SELF' : dto.about === 'student' ? 'STUDENT' : 'TEACHER',
      aboutLabel,
      requesterDocument,
      affectedDocument,
      description: dto.description,
      priority: priority.level,
      estimate: priority.estimate,
      assignedName: null,
      assignedMemberId: null,
      dueOn: null,
      emittedInternally: false,
      attachmentNames: dto.attachmentNames,
      now,
    });
  }

  async createInternal(actor: TicketsActor, dto: CreateInternalTicketDto) {
    if (actor.role !== 'area_manager' && actor.role !== 'admin') throw new ForbiddenException();
    const area = await this.prisma.area.findFirst({ where: { code: 'TI' } });
    const category = await this.prisma.ticketCategory.findFirst({ where: { areaId: area?.id, name: dto.categoryName } });
    if (!area || !category) throw new BadRequestException('No pudimos registrar el ticket interno.');
    const assignee = await this.prisma.teamMember.findFirst({ where: { fullName: dto.assignedName } });
    const now = new Date();
    return this.createTicket({
      kind: 'INTERNAL',
      actor,
      actorArea: 'TI',
      requesterRole: 'Responsable de TI',
      areaId: area.id,
      categoryId: category.id,
      categoryName: category.name,
      destinationAreaCode: area.code,
      about: 'SELF',
      aboutLabel: `Responsable de TI · ${actor.displayName}`,
      requesterDocument: actor.documentNumber,
      affectedDocument: '',
      description: dto.description,
      priority: dto.priority,
      estimate: (await this.priorityFor(category.name)).estimate,
      assignedName: dto.assignedName,
      assignedMemberId: assignee?.id ?? null,
      dueOn: new Date(`${dto.dueOn}T00:00:00.000Z`),
      emittedInternally: true,
      attachmentNames: dto.attachmentNames,
      now,
    });
  }

  async reopen(actor: TicketsActor, id: string, reason: string) {
    const ticket = await this.requireTicket(id);
    if (ticket.requesterUserId !== actor.id) throw new ForbiddenException();
    if (!canReopenTicket(ticket.resolvedAt, ticket.status)) {
      throw new BadRequestException('El plazo de reapertura ya venció.');
    }
    await this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'REOPENED',
        estimate: 'Pendiente de nueva revisión',
        description: `${ticket.description}\n\nMotivo de reapertura: ${reason}`,
        history: {
          create: { status: 'REOPENED', actorName: actor.displayName, actorArea: 'Solicitante', note: reason },
        },
      },
    });
  }

  async updateInternal(actor: TicketsActor, id: string, dto: UpdateInternalTicketDto) {
    if (actor.role !== 'area_manager' && actor.role !== 'admin') throw new ForbiddenException();
    const ticket = await this.requireTicket(id);
    if (ticket.kind !== 'INTERNAL' || !ticket.emittedInternally) {
      throw new BadRequestException('Solo se pueden editar tickets internos emitidos.');
    }
    if (ticket.status !== 'CREATED') throw new BadRequestException('El ticket ya no se puede editar.');
    const area = await this.prisma.area.findFirst({ where: { code: 'TI' } });
    const category = await this.prisma.ticketCategory.findFirst({ where: { areaId: area?.id, name: dto.categoryName } });
    if (!area || !category) throw new BadRequestException('No encontramos la categoría.');
    const assignee = await this.prisma.teamMember.findFirst({ where: { fullName: dto.assignedName } });
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedName: dto.assignedName,
        assignedMemberId: assignee?.id ?? null,
        dueOn: new Date(`${dto.dueOn}T00:00:00.000Z`),
        priority: dto.priority,
        categoryId: category.id,
        categoryName: category.name,
        estimate: (await this.priorityFor(category.name)).estimate,
        description: dto.description,
      },
    });
  }

  async changeStatus(actor: TicketsActor, id: string, dto: ChangeTicketStatusDto) {
    if (actor.role === 'requester') throw new ForbiddenException();
    const ticket = await this.requireTicket(id);
    const error = statusChangeError(ticket.status, dto.status, dto.note ?? '', dto.assignedName ?? '');
    if (error) throw new BadRequestException(error);
    const assignee = dto.assignedName
      ? await this.prisma.teamMember.findFirst({ where: { fullName: dto.assignedName } })
      : null;
    const status = dto.status as TicketStatus;
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status,
        assignedName: status === 'DERIVED' ? dto.assignedName : ticket.assignedName,
        assignedMemberId: status === 'DERIVED' ? assignee?.id ?? null : ticket.assignedMemberId,
        receiverResponse: dto.note || ticket.receiverResponse,
        resolvedAt: status === 'RESOLVED' ? new Date() : ticket.resolvedAt,
        history: {
          create: {
            status,
            actorName: actor.displayName,
            actorArea: 'TI',
            fromName: status === 'DERIVED' ? actor.displayName : undefined,
            toName: status === 'DERIVED' ? dto.assignedName : undefined,
            note: dto.note || undefined,
          },
        },
        attachments: dto.attachmentNames?.length
          ? { create: dto.attachmentNames.map((fileName) => ({ fileName })) }
          : undefined,
      },
    });
  }

  private async createTicket(input: {
    readonly kind: 'EXTERNAL' | 'INTERNAL';
    readonly actor: TicketsActor;
    readonly actorArea: string;
    readonly requesterRole: string;
    readonly areaId: string;
    readonly categoryId: string;
    readonly categoryName: string;
    readonly destinationAreaCode: string;
    readonly about: 'SELF' | 'STUDENT' | 'TEACHER';
    readonly aboutLabel: string;
    readonly requesterDocument: string;
    readonly affectedDocument: string;
    readonly description: string;
    readonly priority: 'HIGH' | 'MEDIUM' | 'LOW';
    readonly estimate: string;
    readonly assignedName: string | null;
    readonly assignedMemberId: string | null;
    readonly dueOn: Date | null;
    readonly emittedInternally: boolean;
    readonly attachmentNames: readonly string[];
    readonly now: Date;
  }) {
    const prefix = ticketCodePrefix(input.destinationAreaCode, input.now);
    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.ticketSequence.upsert({
        where: { prefix },
        update: { nextValue: { increment: 1 } },
        create: { prefix, nextValue: 1 },
      });
      const ticket = await tx.ticket.create({
        data: {
          code: formatTicketCode(prefix, sequence.nextValue),
          kind: input.kind,
          requesterUserId: input.actor.id,
          requesterName: input.actor.displayName,
          requesterDocument: input.requesterDocument,
          requesterRole: input.requesterRole,
          about: input.about,
          aboutLabel: input.aboutLabel,
          affectedDocument: input.affectedDocument,
          areaId: input.areaId,
          categoryId: input.categoryId,
          categoryName: input.categoryName,
          destinationAreaCode: input.destinationAreaCode,
          priority: input.priority,
          estimate: input.estimate,
          assignedName: input.assignedName,
          assignedMemberId: input.assignedMemberId,
          dueOn: input.dueOn,
          description: input.description,
          emittedInternally: input.emittedInternally,
          history: { create: { status: 'CREATED', actorName: input.actor.displayName, actorArea: input.actorArea } },
          attachments: { create: input.attachmentNames.map((fileName) => ({ fileName })) },
        },
        include: { history: { orderBy: { at: 'asc' } }, attachments: true },
      });
      return toTicketView(ticket);
    });
  }

  private async priorityFor(categoryName: string): Promise<{ level: 'HIGH' | 'MEDIUM' | 'LOW'; estimate: string }> {
    const match = await this.prisma.priorityActivity.findFirst({ where: { categoryName } });
    if (!match) return { level: 'MEDIUM', estimate: 'Según disponibilidad' };
    return { level: match.level, estimate: match.estimate };
  }

  private async requireTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('No encontramos el ticket.');
    return ticket;
  }
}

const toTicketView = (ticket: {
  id: string;
  code: string;
  kind: 'EXTERNAL' | 'INTERNAL';
  createdAt: Date;
  academicArea: string;
  about: 'SELF' | 'STUDENT' | 'TEACHER';
  aboutLabel: string;
  requesterDocument: string;
  affectedDocument: string;
  categoryName: string;
  status: TicketStatus;
  estimate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  requesterName: string;
  requesterRole: string;
  assignedName: string | null;
  dueOn: Date | null;
  description: string;
  receiverResponse: string;
  resolvedAt: Date | null;
  destinationAreaCode: string;
  emittedInternally: boolean;
  history: readonly { status: TicketStatus; at: Date; actorName: string; actorArea: string; fromName: string | null; toName: string | null }[];
  attachments: readonly { fileName: string }[];
}) => ({
  id: ticket.id,
  code: ticket.code,
  kind: ticket.kind,
  createdAt: ticket.createdAt.toISOString(),
  academicArea: ticket.academicArea,
  about: ticket.about,
  aboutLabel: ticket.aboutLabel,
  requesterDocument: ticket.requesterDocument,
  affectedDocument: ticket.affectedDocument,
  categoryName: ticket.categoryName,
  status: ticket.status,
  estimate: ticket.estimate,
  priority: ticket.priority,
  requesterName: ticket.requesterName,
  requesterRole: ticket.requesterRole,
  assignedName: ticket.assignedName,
  dueOn: ticket.dueOn ? ticket.dueOn.toISOString().slice(0, 10) : null,
  description: ticket.description,
  receiverResponse: ticket.receiverResponse,
  resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  attachmentNames: ticket.attachments.map((item) => item.fileName),
  history: ticket.history.map((entry) => ({
    status: entry.status,
    at: entry.at.toISOString(),
    actorName: entry.actorName,
    actorArea: entry.actorArea,
    ...(entry.fromName ? { fromName: entry.fromName } : {}),
    ...(entry.toName ? { toName: entry.toName } : {}),
  })),
  destinationAreaCode: ticket.destinationAreaCode,
  emittedInternally: ticket.emittedInternally,
});
