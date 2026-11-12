const PRIVILEGED_ROLES = new Set(['ADMINISTRATOR', 'DIRECTOR']);
const PRIVILEGED_APPLICATION_ROLES = new Set([
  'tickets.admin',
  'tickets.area_manager',
  'study-plans.faculty',
]);

/** El segundo factor es obligatorio para quien administra identidad, la operación académica o tickets. */
export const requiresMfa = (roles: readonly string[], applicationRoles: readonly string[] = []): boolean =>
  roles.some((role) => PRIVILEGED_ROLES.has(role))
  || applicationRoles.some((role) => PRIVILEGED_APPLICATION_ROLES.has(role));
