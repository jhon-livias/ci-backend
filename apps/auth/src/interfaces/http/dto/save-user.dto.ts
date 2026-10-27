import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateBy, ValidateNested } from 'class-validator';

import { INSTITUTIONAL_EMAIL_MESSAGE, isInstitutionalEmail } from '../../../domain/institutional-email.js';
import { DOCUMENT_TYPES, MOBILE_COUNTRIES } from '../../../domain/user-account.js';

const NAME = /^[^<>]{1,100}$/u;
const PLAIN = /^[^<>]{1,120}$/u;
const trimText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};
const lowerEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class UserGrantDto {
  @IsUUID('all')
  permissionId!: string;

  @Transform(trimText)
  @IsString()
  @Matches(PLAIN)
  name!: string;

  @IsBoolean()
  enabled!: boolean;
}

export class SaveUserDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: (typeof DOCUMENT_TYPES)[number];

  @Transform(trimText)
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,12}$/u)
  documentNumber!: string;

  @Transform(trimText)
  @IsString()
  @Matches(NAME)
  firstName!: string;

  @Transform(trimText)
  @IsString()
  @Matches(NAME)
  paternalLastName!: string;

  @Transform(trimText)
  @IsString()
  @Matches(NAME)
  maternalLastName!: string;

  @IsUUID('all')
  siteId!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\s()-]{6,30}$/u)
  phone?: string;

  @IsIn(MOBILE_COUNTRIES)
  mobileCountry!: (typeof MOBILE_COUNTRIES)[number];

  @Transform(trimText)
  @IsString()
  @Matches(/^\d{6,15}$/u)
  mobile!: string;

  @Transform(lowerEmail)
  @IsString()
  @MaxLength(254)
  @ValidateBy({
    name: 'institutionalEmail',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && isInstitutionalEmail(value),
      defaultMessage: () => INSTITUTIONAL_EMAIL_MESSAGE,
    },
  })
  email!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^[^<>]{8,72}$/u)
  password?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UserGrantDto)
  grants!: UserGrantDto[];
}

export class UpdateUserDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: (typeof DOCUMENT_TYPES)[number];

  @Transform(trimText)
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,12}$/u)
  documentNumber!: string;

  @Transform(trimText)
  @IsString()
  @Matches(NAME)
  firstName!: string;

  @Transform(trimText)
  @IsString()
  @Matches(NAME)
  paternalLastName!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Matches(NAME)
  maternalLastName?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID('all')
  siteId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\s()-]{6,30}$/u)
  phone?: string;

  @IsOptional()
  @IsIn(MOBILE_COUNTRIES)
  mobileCountry?: (typeof MOBILE_COUNTRIES)[number];

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,15}$/u)
  mobile?: string;

  @Transform(lowerEmail)
  @IsString()
  @MaxLength(254)
  @ValidateBy({
    name: 'institutionalEmail',
    validator: {
      validate: (value: unknown) => typeof value === 'string' && isInstitutionalEmail(value),
      defaultMessage: () => INSTITUTIONAL_EMAIL_MESSAGE,
    },
  })
  email!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^[^<>]{8,72}$/u)
  password?: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UserGrantDto)
  grants?: UserGrantDto[];
}
