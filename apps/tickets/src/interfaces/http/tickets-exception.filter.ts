import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { persistenceMessage, publicMessage } from '../../domain/persistence-message.js';

@Catch()
export class TicketsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const persisted = persistenceMessage(exception);
    if (persisted) {
      void reply.status(HttpStatus.BAD_REQUEST).send({ message: persisted });
      return;
    }
    if (exception instanceof HttpException) {
      void reply.status(exception.getStatus()).send({ message: publicMessage(exception.getResponse(), exception.message) });
      return;
    }
    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ message: publicMessage(exception) });
  }
}
