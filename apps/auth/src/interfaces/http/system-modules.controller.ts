import { Controller, Get, Header, UseGuards } from '@nestjs/common';

import { SYSTEM_MODULES } from '../../domain/system-modules.js';
import { ModulesReadGuard } from './access-policy.guard.js';

@Controller('auth/admin/modules')
@UseGuards(ModulesReadGuard)
export class SystemModulesController {
  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return { modules: SYSTEM_MODULES };
  }
}
