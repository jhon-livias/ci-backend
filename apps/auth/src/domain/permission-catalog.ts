export const PERMISSION_MODULES = [
  { code: 'estudiante', name: 'Estudiante' },
  { code: 'docente', name: 'Docente' },
  { code: 'asesora', name: 'Asesora' },
  { code: 'director', name: 'Director' },
  { code: 'administrador', name: 'Administrador' },
] as const;

export type PermissionModuleCode = (typeof PERMISSION_MODULES)[number]['code'];

const PLAIN_TEXT = /^[^<>]{1,120}$/u;

export class PermissionRuleError extends Error {
  constructor(readonly rule: 'module' | 'name' | 'functionalities') {
    super(rule);
  }
}

export interface NormalizedPermission {
  readonly moduleCode: PermissionModuleCode;
  readonly name: string;
  readonly enabled: boolean;
  readonly functionalities: readonly string[];
}

export const isPermissionModule = (value: string): value is PermissionModuleCode =>
  PERMISSION_MODULES.some((module) => module.code === value);

export const permissionModules = () => PERMISSION_MODULES.map((module) => ({ code: module.code, name: module.name }));

export const normalizePermission = (input: {
  readonly moduleCode: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly functionalities: readonly string[];
}): NormalizedPermission => {
  if (!isPermissionModule(input.moduleCode)) throw new PermissionRuleError('module');
  const name = input.name.trim();
  if (!PLAIN_TEXT.test(name)) throw new PermissionRuleError('name');
  if (input.functionalities.length < 1 || input.functionalities.length > 12) throw new PermissionRuleError('functionalities');

  const seen = new Set<string>();
  const functionalities = input.functionalities.map((item) => item.trim());
  for (const functionality of functionalities) {
    const key = functionality.toLocaleLowerCase('es');
    if (!PLAIN_TEXT.test(functionality) || seen.has(key)) throw new PermissionRuleError('functionalities');
    seen.add(key);
  }

  return { moduleCode: input.moduleCode, name, enabled: input.enabled, functionalities };
};
