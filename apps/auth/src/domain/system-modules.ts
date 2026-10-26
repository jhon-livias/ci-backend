/** Grupos de personas del directorio. El conteo no concede permisos. */
export const DIRECTORY_MODULES = [
  { code: 'TEACHER', name: 'Docente' },
  { code: 'STUDENT', name: 'Alumnos' },
  { code: 'ADVISOR', name: 'Asesora' },
  { code: 'DIRECTOR', name: 'Director' },
  { code: 'ADMINISTRATOR', name: 'Administrador' },
] as const;

export interface DirectoryModuleCount {
  readonly role: string;
  readonly active: number;
  readonly inactive: number;
}

export interface DirectoryModuleQuery {
  readonly search?: string;
  readonly occupied?: boolean;
  readonly page: number;
  readonly pageSize: 5 | 10 | 20;
  readonly sort?: 'name' | 'users' | 'active' | 'inactive';
  readonly direction?: 'asc' | 'desc';
}

export interface DirectoryModuleRow {
  readonly code: string;
  readonly name: string;
  readonly users: number;
  readonly active: number;
  readonly inactive: number;
}

export const presentModuleDirectory = (counts: readonly DirectoryModuleCount[], query: DirectoryModuleQuery) => {
  const byRole = new Map(counts.map((count) => [count.role, count]));
  let rows: DirectoryModuleRow[] = DIRECTORY_MODULES.map((module) => {
    const count = byRole.get(module.code);
    const active = count?.active ?? 0;
    const inactive = count?.inactive ?? 0;
    return { code: module.code, name: module.name, users: active + inactive, active, inactive };
  });
  const search = query.search?.trim().toLocaleLowerCase('es') ?? '';
  if (search) rows = rows.filter((row) => row.name.toLocaleLowerCase('es').includes(search));
  if (query.occupied) rows = rows.filter((row) => row.users > 0);
  if (query.sort) {
    const direction = query.direction === 'desc' ? -1 : 1;
    const sort = query.sort;
    rows = [...rows].sort((left, right) => sort === 'name'
      ? left.name.localeCompare(right.name, 'es') * direction
      : (left[sort] - right[sort]) * direction);
  }
  const start = (query.page - 1) * query.pageSize;
  return {
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length,
    modules: rows.slice(start, start + query.pageSize),
  };
};
