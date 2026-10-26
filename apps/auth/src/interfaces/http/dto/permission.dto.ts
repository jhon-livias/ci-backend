import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { PERMISSION_MODULES } from '../../../domain/permission-catalog.js';

const MODULE_CODES = PERMISSION_MODULES.map((module) => module.code);
const PLAIN_TEXT = /^[^<>]{1,120}$/u;

const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListPermissionsDto {
  @IsOptional()
  @Transform(trimText)
  @IsIn(MODULE_CODES)
  module?: (typeof MODULE_CODES)[number];

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/u)
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10, 20])
  pageSize = 5;
}

export class FunctionalityDto {
  @Transform(trimText)
  @IsString()
  @Matches(PLAIN_TEXT)
  name!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class SavePermissionDto {
  @IsIn(MODULE_CODES)
  moduleCode!: (typeof MODULE_CODES)[number];

  @Transform(trimText)
  @IsString()
  @Matches(PLAIN_TEXT)
  name!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FunctionalityDto)
  functionalities!: FunctionalityDto[];
}

export class UpdatePermissionDto {
  @IsOptional()
  @IsIn(MODULE_CODES)
  moduleCode?: (typeof MODULE_CODES)[number];

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Matches(PLAIN_TEXT)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FunctionalityDto)
  functionalities?: FunctionalityDto[];
}
