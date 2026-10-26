import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { UserDirectoryService } from '../../application/user-directory.service.js';
import { UsersReadGuard } from './access-policy.guard.js';
import { ListUsersDto } from './dto/list-users.dto.js';

@Controller('auth/admin/users')
@UseGuards(UsersReadGuard)
export class UserDirectoryController {
  constructor(private readonly directory: UserDirectoryService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListUsersDto) {
    return this.directory.list(query.page);
  }
}
