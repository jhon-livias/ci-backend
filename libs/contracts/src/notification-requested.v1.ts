export const NOTIFICATION_REQUESTED_V1 = 'notification.requested.v1';

export interface NotificationRequestedV1 {
  readonly id: string;
  readonly recipientUserId: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly correlationId: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plainText = /^[^<>]{1,500}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNotificationRequestedV1 = (value: unknown): value is NotificationRequestedV1 => {
  if (!isRecord(value)) return false;
  const createdAt = value['createdAt'];
  return (
    typeof value['id'] === 'string' && uuid.test(value['id']) &&
    typeof value['recipientUserId'] === 'string' && uuid.test(value['recipientUserId']) &&
    typeof value['title'] === 'string' && value['title'].length >= 1 && value['title'].length <= 120 && !/[<>]/.test(value['title']) &&
    typeof value['body'] === 'string' && plainText.test(value['body']) &&
    typeof value['correlationId'] === 'string' && value['correlationId'].length >= 8 && value['correlationId'].length <= 64 &&
    typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))
  );
};
