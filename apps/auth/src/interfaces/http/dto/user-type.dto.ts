import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const PLAIN_TEXT = /^[^<>]{1,120}$/u;
const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListUserTypesDto {
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

export class UserTypePermissionDto {
  @IsUUID()
  id!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class SaveUserTypeDto {
  @Transform(trimText)
  @IsString()
  @Matches(PLAIN_TEXT)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UserTypePermissionDto)
  permissions!: UserTypePermissionDto[];
}

export class UpdateUserTypeDto {
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
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UserTypePermissionDto)
  permissions?: UserTypePermissionDto[];
}
