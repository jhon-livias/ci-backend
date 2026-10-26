import { Injectable } from '@nestjs/common';

export interface NotificationSocket {
  readonly readyState: number;
  send(data: string): void;
}

export interface NotificationPush {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly unread: boolean;
}

const openState = 1;
const maxSocketsPerUser = 5;

@Injectable()
export class NotificationHub {
  private readonly sockets = new Map<string, Set<NotificationSocket>>();

  add(userId: string, socket: NotificationSocket): boolean {
    const current = this.sockets.get(userId) ?? new Set<NotificationSocket>();
    if (current.size >= maxSocketsPerUser) return false;
    current.add(socket);
    this.sockets.set(userId, current);
    return true;
  }

  remove(userId: string, socket: NotificationSocket): void {
    const current = this.sockets.get(userId);
    if (!current) return;
    current.delete(socket);
    if (current.size === 0) this.sockets.delete(userId);
  }

  push(userId: string, notification: NotificationPush): void {
    const payload = JSON.stringify(notification);
    for (const socket of this.sockets.get(userId) ?? []) {
      if (socket.readyState === openState) socket.send(payload);
    }
  }
}
