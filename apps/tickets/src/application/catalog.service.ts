import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { accessFromMemberships } from '../domain/membership-access.js';
import { TicketsPrismaService } from '../infrastructure/persistence/tickets-prisma.service.js';
import type { AddPriorityActivityDto, SaveAreaDto, SaveCategoryDto, SaveMemberDto } from '../interfaces/http/dto/catalog.dto.js';
import { AccountProvisionClient } from './account-provision.client.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: TicketsPrismaService,
    private readonly accounts: AccountProvisionClient,
  ) {}

  async snapshot() {
    const [areas, categories, team, levels, memberships] = await Promise.all([
      this.prisma.area.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
      this.prisma.ticketCategory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.teamMember.findMany({ orderBy: [{ isManager: 'desc' }, { fullName: 'asc' }] }),
      this.prisma.priorityLevel.findMany({ include: { activities: { orderBy: { createdAt: 'asc' } } } }),
      this.prisma.areaMembership.findMany({ select: { userId: true, areaId: true, kind: true } }),
    ]);
    return {
      areas: areas.map((area) => ({
        id: area.id,
        parentId: area.parentId,
        code: area.code,
        name: area.name,
        responsibility: area.responsibility,
        managerName: area.managerName,
        managerDocument: area.managerDocument,
        managerEmail: area.managerEmail,
        receivesTickets: area.receivesTickets,
        allowsInternal: area.allowsInternal,
        canCreateTickets: area.canCreateTickets,
        enabled: area.enabled,
      })),
      categories: categories.map((category) => ({
        id: category.id,
        areaId: category.areaId,
        name: category.name,
        description: category.description,
        enabled: category.enabled,
      })),
      team: team.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        document: member.document,
        roleTitle: member.roleTitle,
        email: member.email,
        phone: member.phone,
        functions: member.functions,
        schedule: member.schedule,
        isManager: member.isManager,
        areaIds: memberships
          .filter((item) => item.kind === 'COLLABORATOR' && member.userId !== null && item.userId === member.userId)
          .map((item) => item.areaId),
      })),
      priorities: (['HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
        const row = levels.find((item) => item.level === level);
        return {
          level,
          description: row?.description ?? '',
          activities: (row?.activities ?? []).map((activity) => ({
            id: activity.id,
            categoryName: activity.categoryName,
            activity: activity.activity,
            estimate: activity.estimate,
          })),
        };
      }),
    };
  }

  async accessFor(userId: string) {
    const memberships = await this.prisma.areaMembership.findMany({
      where: { userId },
      include: { area: true },
      orderBy: { area: { name: 'asc' } },
    });
    const areas = memberships.map((item) => ({
      areaId: item.areaId,
      name: item.area.name,
      enabled: item.area.enabled,
      canCreateTickets: item.area.canCreateTickets,
      receivesTickets: item.area.receivesTickets,
    }));
    return {
      ...accessFromMemberships(areas),
      memberships: memberships.map((item) => ({
        areaId: item.areaId,
        code: item.area.code,
        name: item.area.name,
        enabled: item.area.enabled,
        canCreateTickets: item.area.canCreateTickets,
        receivesTickets: item.area.receivesTickets,
      })),
    };
  }

  async saveArea(id: string | null, dto: SaveAreaDto) {
    const parentId = dto.parentId || null;
    if (parentId) {
      const parent = await this.prisma.area.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('No encontramos el área padre.');
      if (id && parentId === id) throw new BadRequestException('Un área no puede ser su propio padre.');
    }
    const data = {
      parentId,
      code: dto.code,
      name: dto.name,
      responsibility: dto.responsibility,
      managerName: dto.managerName,
      managerDocument: dto.managerDocument,
      managerEmail: dto.managerEmail,
      receivesTickets: dto.receivesTickets,
      allowsInternal: dto.allowsInternal,
      canCreateTickets: dto.canCreateTickets,
      enabled: dto.enabled,
    };
    if (!/^\d{8}$/u.test(dto.managerDocument)) throw new BadRequestException('El DNI del responsable debe tener 8 dígitos.');
    if (dto.managerName.trim().length < 3) throw new BadRequestException('Escribe el nombre del responsable.');
    if (id) await this.requireArea(id);
    const codeOwner = await this.prisma.area.findUnique({ where: { code: dto.code } });
    if (codeOwner && codeOwner.id !== id) throw new BadRequestException('Ya existe un área con esas siglas.');
    const account = await this.accounts.provision({
      email: dto.managerEmail,
      documentNumber: dto.managerDocument,
      fullName: dto.managerName,
      roles: ['tickets.area_manager'],
    });
    await this.prisma.$transaction(async (tx) => {
      const area = id
        ? await tx.area.update({ where: { id }, data })
        : await tx.area.create({ data });
      await tx.areaMembership.deleteMany({ where: { areaId: area.id, kind: 'MANAGER', userId: { not: account.userId } } });
      await tx.areaMembership.upsert({
        where: { userId_areaId: { userId: account.userId, areaId: area.id } },
        create: {
          userId: account.userId,
          areaId: area.id,
          email: dto.managerEmail,
          fullName: dto.managerName,
          document: dto.managerDocument,
          phone: '',
          roleTitle: 'Responsable',
          kind: 'MANAGER',
        },
        update: {
          email: dto.managerEmail,
          fullName: dto.managerName,
          document: dto.managerDocument,
          phone: '',
          roleTitle: 'Responsable',
          kind: 'MANAGER',
        },
      });
    });
    return { accountCreated: account.created, username: account.username };
  }

  async removeArea(id: string) {
    const area = await this.requireArea(id);
    const [children, tickets] = await Promise.all([
      this.prisma.area.count({ where: { parentId: id } }),
      this.prisma.ticket.count({ where: { areaId: id } }),
    ]);
    if (children || tickets) throw new BadRequestException('No se puede eliminar un área con dependencias o tickets.');
    await this.prisma.ticketCategory.deleteMany({ where: { areaId: id } });
    await this.prisma.area.delete({ where: { id: area.id } });
  }

  async saveCategory(id: string | null, dto: SaveCategoryDto) {
    await this.requireArea(dto.areaId);
    const named = await this.prisma.ticketCategory.findFirst({ where: { areaId: dto.areaId, name: dto.name } });
    if (named && named.id !== id) throw new BadRequestException('Ya existe una categoría con ese nombre en el área.');
    const data = { areaId: dto.areaId, name: dto.name, description: dto.description, enabled: dto.enabled };
    if (id) {
      await this.requireCategory(id);
      return this.prisma.ticketCategory.update({ where: { id }, data });
    }
    return this.prisma.ticketCategory.create({ data });
  }

  async removeCategory(id: string) {
    await this.requireCategory(id);
    const tickets = await this.prisma.ticket.count({ where: { categoryId: id } });
    if (tickets) throw new BadRequestException('No se puede eliminar una categoría con tickets.');
    await this.prisma.ticketCategory.delete({ where: { id } });
  }

  async saveMember(id: string | null, dto: SaveMemberDto) {
    if (id) {
      const current = await this.requireMember(id);
      if (current.isManager) {
        await this.prisma.teamMember.update({
          where: { id },
          data: { functions: dto.functions, schedule: dto.schedule },
        });
        return { id, accountCreated: false, username: current.email };
      }
    }
    const areaIds = [...new Set(dto.areaIds ?? [])];
    if (areaIds.length < 1) throw new BadRequestException('Selecciona al menos un área.');
    const areas = await this.prisma.area.findMany({ where: { id: { in: areaIds } }, select: { id: true } });
    if (areas.length !== areaIds.length) throw new BadRequestException('Selecciona áreas válidas.');
    const documentOwner = await this.prisma.teamMember.findUnique({ where: { document: dto.document } });
    const emailOwner = await this.prisma.teamMember.findFirst({
      where: { email: { equals: dto.email, mode: 'insensitive' }, ...(id ? { id: { not: id } } : {}) },
    });
    if (documentOwner && documentOwner.id !== (id ?? emailOwner?.id)) throw new BadRequestException('Ese DNI ya está registrado en el equipo.');
    if (id && emailOwner) throw new BadRequestException('Ese correo ya está registrado en el equipo.');
    const account = await this.accounts.provision({
      email: dto.email,
      documentNumber: dto.document,
      fullName: dto.fullName,
      phone: dto.phone,
      roles: ['tickets.assistant', 'tickets.requester'],
    });
    const data = {
      fullName: dto.fullName,
      document: dto.document,
      roleTitle: dto.roleTitle,
      email: dto.email,
      phone: dto.phone,
      functions: dto.functions,
      schedule: dto.schedule,
      userId: account.userId,
    };
    const linked = await this.prisma.teamMember.findUnique({ where: { userId: account.userId } });
    const targetId = id ?? emailOwner?.id ?? linked?.id ?? null;
    if (linked && targetId && linked.id !== targetId) throw new BadRequestException('Ese correo ya está registrado en el equipo.');
    const member = await this.prisma.$transaction(async (tx) => {
      const saved = targetId
        ? await tx.teamMember.update({ where: { id: targetId }, data })
        : await tx.teamMember.create({ data: { ...data, isManager: false } });
      await tx.areaMembership.deleteMany({ where: { userId: account.userId, kind: 'COLLABORATOR' } });
      await tx.areaMembership.createMany({
        data: areaIds.map((areaId) => ({
          userId: account.userId,
          areaId,
          email: dto.email,
          fullName: dto.fullName,
          document: dto.document,
          phone: dto.phone,
          roleTitle: dto.roleTitle,
          kind: 'COLLABORATOR' as const,
        })),
      });
      return saved;
    });
    return { id: member.id, accountCreated: account.created, username: account.username };
  }

  async removeMember(id: string) {
    const member = await this.requireMember(id);
    if (member.isManager) throw new BadRequestException('No se puede quitar al responsable del área.');
    await this.prisma.ticket.updateMany({ where: { assignedMemberId: id }, data: { assignedMemberId: null } });
    if (member.userId) await this.prisma.areaMembership.deleteMany({ where: { userId: member.userId, kind: 'COLLABORATOR' } });
    await this.prisma.teamMember.delete({ where: { id } });
  }

  async addPriorityActivity(dto: AddPriorityActivityDto) {
    await this.prisma.priorityLevel.upsert({
      where: { level: dto.level },
      update: {},
      create: { level: dto.level, description: '' },
    });
    return this.prisma.priorityActivity.create({
      data: { level: dto.level, categoryName: dto.categoryName, activity: dto.activity, estimate: dto.estimate },
    });
  }

  async removePriorityActivity(id: string) {
    const activity = await this.prisma.priorityActivity.findUnique({ where: { id } });
    if (!activity) throw new NotFoundException('No encontramos la actividad.');
    await this.prisma.priorityActivity.delete({ where: { id } });
  }

  private async requireArea(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('No encontramos el área.');
    return area;
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.ticketCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('No encontramos la categoría.');
    return category;
  }

  private async requireMember(id: string) {
    const member = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('No encontramos al integrante.');
    return member;
  }
}
