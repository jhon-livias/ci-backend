import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { TicketsPrismaService } from '../infrastructure/persistence/tickets-prisma.service.js';
import type { AddPriorityActivityDto, SaveAreaDto, SaveCategoryDto, SaveMemberDto } from '../interfaces/http/dto/catalog.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: TicketsPrismaService) {}

  async snapshot() {
    const [areas, categories, team, levels] = await Promise.all([
      this.prisma.area.findMany({ orderBy: [{ parentId: 'asc' }, { name: 'asc' }] }),
      this.prisma.ticketCategory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.teamMember.findMany({ orderBy: [{ isManager: 'desc' }, { fullName: 'asc' }] }),
      this.prisma.priorityLevel.findMany({ include: { activities: { orderBy: { createdAt: 'asc' } } } }),
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
      })),
      priorities: (['HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
        const row = levels.find((item) => item.level === level);
        return {
          level,
          description: row?.description ?? '',
          activities: (row?.activities ?? []).map((activity) => ({
            categoryName: activity.categoryName,
            activity: activity.activity,
            estimate: activity.estimate,
          })),
        };
      }),
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
    if (id) {
      await this.requireArea(id);
      return this.prisma.area.update({ where: { id }, data });
    }
    return this.prisma.area.create({ data });
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
    const data = {
      fullName: dto.fullName,
      document: dto.document,
      roleTitle: dto.roleTitle,
      email: dto.email,
      phone: dto.phone,
      functions: dto.functions,
      schedule: dto.schedule,
    };
    if (id) {
      const current = await this.requireMember(id);
      return this.prisma.teamMember.update({
        where: { id },
        data: { ...data, roleTitle: current.isManager ? current.roleTitle : dto.roleTitle },
      });
    }
    return this.prisma.teamMember.create({ data: { ...data, isManager: false } });
  }

  async removeMember(id: string) {
    const member = await this.requireMember(id);
    if (member.isManager) throw new BadRequestException('No se puede quitar al responsable del área.');
    await this.prisma.ticket.updateMany({ where: { assignedMemberId: id }, data: { assignedMemberId: null } });
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
