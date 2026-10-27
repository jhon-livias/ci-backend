import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

import { readSmtpSettings } from '../../domain/smtp-mail.js';

export interface OutboundMail {
  readonly enabled: boolean;
  send(message: { readonly to: string; readonly subject: string; readonly text: string }): Promise<void>;
}

@Injectable()
export class SmtpMailChannel implements OutboundMail {
  private readonly logger = new Logger(SmtpMailChannel.name);
  private readonly settings = readSmtpSettings(process.env);
  readonly enabled = this.settings !== null;

  constructor() {
    if (!this.enabled) {
      this.logger.warn('SMTP_USER o SMTP_PASSWORD no están definidos: el correo de recuperación no se envía.');
    }
  }

  async send(message: { readonly to: string; readonly subject: string; readonly text: string }): Promise<void> {
    if (!this.settings) throw new Error('El correo saliente no está configurado.');
    const transport = nodemailer.createTransport({
      host: this.settings.host,
      port: this.settings.port,
      secure: this.settings.port === 465,
      requireTLS: this.settings.port === 587,
      auth: { user: this.settings.user, pass: this.settings.password },
    });
    await transport.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
