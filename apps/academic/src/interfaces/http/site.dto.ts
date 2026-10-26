import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => typeof value === 'string' ? value.trim() : value;

export class SiteDto {
  @Transform(trim) @IsString() @Matches(/^[A-Z0-9_-]{2,32}$/)
  code!: string;

  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) @Matches(/^[^<>]+$/)
  name!: string;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(255) @Matches(/^[^<>]*$/)
  location?: string | null;

  @Transform(trim) @IsOptional() @IsString() @MaxLength(255) @Matches(/^[^<>]*$/) street?: string | null;
  @Transform(trim) @IsOptional() @IsString() @Matches(/^\d{5}$/) postalCode?: string | null;
  @Transform(trim) @IsOptional() @IsString() @Matches(/^[+\d ()-]{6,30}$/) phone?: string | null;
  @Transform(trim) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(trim) @IsOptional() @IsString() @MaxLength(100) @Matches(/^[^<>]*$/) contactName?: string | null;
  @Transform(trim) @IsOptional() @IsString() @Matches(/^[+\d ()-]{6,30}$/) contactPhone?: string | null;

  @Transform(trim) @IsOptional() @IsString() @Matches(/^\d{7}$/)
  districtCode?: string | null;

  @IsBoolean()
  active!: boolean;
}
