import { Controller, Get, Header, UseGuards } from '@nestjs/common';

import { accessPolicyCatalog } from '../../domain/access-policy.js';
import { AccessPolicyGuard } from './access-policy.guard.js';

@Controller('auth/access-policy')
@UseGuards(AccessPolicyGuard)
export class AccessPolicyController {
  @Get()
  @Header('Cache-Control', 'no-store')
  read() {
    return accessPolicyCatalog();
  }
}
