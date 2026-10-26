import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

const SORT_FIELDS = ['name', 'users', 'active', 'inactive'] as const;
const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListModulesDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/u)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : value === true || value === 'true'))
  @IsBoolean()
  occupied?: boolean;

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
