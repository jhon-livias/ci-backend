export const ticketCodePrefix = (areaCode: string, at: Date): string =>
  `${areaCode}${String(at.getFullYear()).slice(-2)}${String(at.getMonth() + 1).padStart(2, '0')}`;

export const formatTicketCode = (prefix: string, sequence: number): string =>
  `${prefix}${String(sequence).padStart(5, '0')}`;
