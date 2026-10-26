import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { AUDIT_MODULES, AUDIT_ROLE_NAMES } from '../../../domain/audit-log.js';

const SORT_FIELDS = ['occurredAt', 'actorName', 'actorRole', 'module', 'action'] as const;
const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListAuditDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/u)
  search?: string;

  @IsOptional()
  @IsIn(AUDIT_ROLE_NAMES)
  role?: (typeof AUDIT_ROLE_NAMES)[number];

  @IsOptional()
  @IsIn(AUDIT_MODULES)
  module?: (typeof AUDIT_MODULES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10, 20])
  pageSize = 5;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';
}
