import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { ModuleDirectoryService } from '../../application/module-directory.service.js';
import { ModulesReadGuard } from './access-policy.guard.js';
import { ListModulesDto } from './dto/list-modules.dto.js';

@Controller('auth/admin/modules')
@UseGuards(ModulesReadGuard)
export class SystemModulesController {
  constructor(private readonly modules: ModuleDirectoryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListModulesDto) {
    return this.modules.list(query);
  }
}
