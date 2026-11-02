export const businessDaysBetween = (from: Date, to: Date): number => {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(to);
  last.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  let count = 0;
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export const canReopenTicket = (resolvedAt: Date | null, status: string, now: Date = new Date()): boolean =>
  status === 'RESOLVED' && resolvedAt !== null && businessDaysBetween(resolvedAt, now) <= 5;
