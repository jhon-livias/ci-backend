import { timingSafeEqual } from 'node:crypto';

import { Body, Controller, Headers, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

import { UserDirectoryService } from '../../application/user-directory.service.js';
import { ProvisionTicketsAccountDto } from './dto/tickets-account.dto.js';

@Controller('auth/internal/tickets')
export class TicketsAccountController {
  constructor(private readonly directory: UserDirectoryService) {}

  @Post('accounts')
  provision(
    @Headers('x-internal-secret') secret: string | undefined,
    @Body() dto: ProvisionTicketsAccountDto,
  ) {
    assertTicketsSecret(secret);
    return this.directory.provisionTicketsAccount(dto);
  }
}

const assertTicketsSecret = (supplied: string | undefined): void => {
  const expected = process.env.TICKETS_AUTH_INTERNAL_SECRET?.trim() ?? '';
  if (expected.length < 32) throw new ServiceUnavailableException('No está configurada la creación de cuentas de tickets.');
  const left = Buffer.from(expected);
  const right = Buffer.from(typeof supplied === 'string' ? supplied : '');
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException();
};
