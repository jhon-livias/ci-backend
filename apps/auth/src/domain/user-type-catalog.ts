const PLAIN_TEXT = /^[^<>]{1,120}$/u;
const PERMISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class UserTypeRuleError extends Error {
  constructor(readonly rule: 'permission' | 'name') {
    super(rule);
  }
}

export interface UserTypePermissionAccess {
  readonly id: string;
  readonly enabled: boolean;
}

export interface NormalizedUserType {
  readonly name: string;
  readonly enabled: boolean;
  readonly permissions: readonly UserTypePermissionAccess[];
}

export const normalizeUserTypeName = (name: string): string => {
  const value = name.trim();
  if (!PLAIN_TEXT.test(value)) throw new UserTypeRuleError('name');
  return value;
};

export const normalizeUserType = (input: {
  readonly name: string;
  readonly enabled: boolean;
  readonly permissions: readonly { readonly id: string; readonly enabled: boolean }[];
}): NormalizedUserType => {
  const name = normalizeUserTypeName(input.name);
  if (input.permissions.length < 1 || input.permissions.length > 100) throw new UserTypeRuleError('permission');

  const seen = new Set<string>();
  const permissions = input.permissions.map((item) => {
    const id = item.id.toLowerCase();
    if (!PERMISSION_ID.test(id) || seen.has(id)) throw new UserTypeRuleError('permission');
    seen.add(id);
    return { id, enabled: item.enabled };
  });
  if (!permissions.some((item) => item.enabled)) throw new UserTypeRuleError('permission');
  return { name, enabled: input.enabled, permissions };
};
