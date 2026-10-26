import { connect, type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import { Logger } from '@nestjs/common';

const exchange = 'ci.events';
const deadLetterExchange = 'ci.events.dlx';

export interface RabbitEndpoint {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
}

export const resolveRabbitEndpoint = (env: NodeJS.ProcessEnv): RabbitEndpoint | undefined => {
  const host = env.RABBITMQ_HOST?.trim() ?? '';
  const user = env.RABBITMQ_USER?.trim() ?? '';
  const password = env.RABBITMQ_PASSWORD ?? '';
  if (!host && !user && !password) return undefined;
  if (!host || !user || password.length < 12) {
    throw new Error('RABBITMQ_HOST, RABBITMQ_USER y RABBITMQ_PASSWORD (mínimo 12 caracteres) deben configurarse juntos.');
  }
  const port = Number(env.RABBITMQ_PORT ?? '5672');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RABBITMQ_PORT no es válido.');
  return { host, port, user, password };
};

export class RabbitEventBus {
  private readonly logger = new Logger(RabbitEventBus.name);
  private model: ChannelModel | undefined;
  private channel: ConfirmChannel | undefined;
  private connecting: Promise<void> | undefined;

  constructor(private readonly endpoint: RabbitEndpoint) {}

  async publish(routingKey: string, payload: unknown, correlationId: string): Promise<void> {
    const channel = await this.channelOrConnect();
    const body = Buffer.from(JSON.stringify(payload));
    await new Promise<void>((resolve, reject) => {
      channel.publish(exchange, routingKey, body, {
        contentType: 'application/json',
        persistent: true,
        messageId: correlationId,
        correlationId,
      }, (error) => (error ? reject(error) : resolve()));
    });
  }

  async subscribe(queue: string, routingKey: string, handle: (payload: unknown) => Promise<void>): Promise<void> {
    const channel = await this.channelOrConnect();
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
    await channel.bindQueue(`${queue}.dlq`, deadLetterExchange, routingKey);
    await channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange,
      deadLetterRoutingKey: routingKey,
    });
    await channel.bindQueue(queue, exchange, routingKey);
    await channel.consume(queue, (message) => {
      void this.consume(channel, message, handle);
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.model?.close();
    this.channel = undefined;
    this.model = undefined;
  }

  private async consume(channel: ConfirmChannel, message: ConsumeMessage | null, handle: (payload: unknown) => Promise<void>): Promise<void> {
    if (!message) return;
    try {
      const payload: unknown = JSON.parse(message.content.toString('utf8'));
      await handle(payload);
      channel.ack(message);
    } catch (error) {
      this.logger.warn(`Evento rechazado hacia la cola muerta: ${error instanceof Error ? error.message : 'error'}`);
      channel.nack(message, false, false);
    }
  }

  private async channelOrConnect(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    if (!this.connecting) this.connecting = this.connect();
    await this.connecting;
    this.connecting = undefined;
    if (!this.channel) throw new Error('RabbitMQ no está conectado.');
    return this.channel;
  }

  private async connect(): Promise<void> {
    const url = `amqp://${encodeURIComponent(this.endpoint.user)}:${encodeURIComponent(this.endpoint.password)}@${this.endpoint.host}:${this.endpoint.port}`;
    this.model = await connect(url);
    this.model.on('error', (error: Error) => this.logger.warn(`RabbitMQ: ${error.message}`));
    this.model.on('close', () => {
      this.channel = undefined;
      this.model = undefined;
    });
    this.channel = await this.model.createConfirmChannel();
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
  }
}
