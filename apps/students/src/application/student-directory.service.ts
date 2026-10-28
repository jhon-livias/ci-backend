import { Injectable } from '@nestjs/common';

import { StudentsPrismaService } from '../infrastructure/persistence/students-prisma.service.js';
import { StudentStatus, StudentType } from '../infrastructure/persistence/generated/client.js';

const present = (row: {
  id: string;
  userId: string;
  studentCode: string | null;
  type: StudentType;
  status: StudentStatus;
  academicProfile: {
    faculty: { name: string } | null;
    school: { name: string } | null;
    career: { name: string } | null;
  } | null;
}) => ({
  id: row.id,
  userId: row.userId,
  studentCode: row.studentCode,
  type: row.type,
  typeLabel: row.type === StudentType.INTERNAL ? 'Interno' : 'Externo',
  status: row.status,
  faculty: row.type === StudentType.INTERNAL ? row.academicProfile?.faculty?.name ?? null : null,
  school: row.type === StudentType.INTERNAL ? row.academicProfile?.school?.name ?? null : null,
  career: row.type === StudentType.INTERNAL ? row.academicProfile?.career?.name ?? null : null,
});

@Injectable()
export class StudentDirectoryService {
  constructor(private readonly db: StudentsPrismaService) {}

  async ensure(userId: string) {
    const include = { academicProfile: { include: { faculty: true, school: true, career: true } } } as const;
    const existing = await this.db.student.findUnique({ where: { userId }, include });
    if (existing) return present(existing);
    const created = await this.db.student.create({
      data: { userId, type: StudentType.EXTERNAL, status: StudentStatus.ACTIVE },
      include,
    });
    return present(created);
  }
}
