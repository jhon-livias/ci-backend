import { Injectable } from '@nestjs/common';

import { AcademicPrismaService } from '../infrastructure/persistence/academic-prisma.service.js';

@Injectable()
export class TeacherProfilesService {
  constructor(private readonly db: AcademicPrismaService) {}

  async list() {
    const rows = await this.db.teacherProfile.findMany({
      select: { userId: true, academicDegree: true, teacherCode: true, status: true },
    });
    return { profiles: rows.map((row) => ({
      userId: row.userId,
      academicDegree: row.academicDegree ?? '',
      teacherCode: row.teacherCode ?? '',
      status: row.status,
    })) };
  }

  async upsert(userId: string, academicDegree: string) {
    const degree = academicDegree.trim().slice(0, 120);
    if (degree.includes('<')) return { userId, academicDegree: '' };
    const row = await this.db.teacherProfile.upsert({
      where: { userId },
      create: { userId, academicDegree: degree || null },
      update: { academicDegree: degree || null },
      select: { userId: true, academicDegree: true },
    });
    return { userId: row.userId, academicDegree: row.academicDegree ?? '' };
  }
}
