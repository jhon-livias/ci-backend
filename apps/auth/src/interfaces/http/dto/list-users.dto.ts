import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

import { FIXED_ROLES } from '../../../domain/access-policy.js';

const ROLE_CODES = FIXED_ROLES.map((role) => role.code);
const STATUS_CODES = ['ACTIVE', 'INVITED', 'SUSPENDED', 'LOCKED'] as const;
const SORT_FIELDS = ['document', 'firstName', 'paternalLastName', 'maternalLastName', 'type'] as const;
const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListUsersDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/u)
  search?: string;

  @IsOptional()
  @IsIn(ROLE_CODES)
  role?: (typeof ROLE_CODES)[number];

  @IsOptional()
  @IsIn(STATUS_CODES)
  status?: (typeof STATUS_CODES)[number];

  @IsOptional()
  @IsUUID('all')
  siteId?: string;

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
