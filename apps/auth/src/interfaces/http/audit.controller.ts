import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { AuditLogService } from '../../application/audit-log.service.js';
import { AuditReadGuard } from './access-policy.guard.js';
import { ListAuditDto } from './dto/list-audit.dto.js';

@Controller('auth/admin/audit')
@UseGuards(AuditReadGuard)
export class AuditController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListAuditDto) {
    return this.audit.list(query);
  }
}
