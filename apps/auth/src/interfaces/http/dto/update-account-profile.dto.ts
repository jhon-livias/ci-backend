import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const COUNTRY_CODES = ['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34'] as const;

export class UpdateAccountProfileDto {
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender!: 'MALE' | 'FEMALE' | 'OTHER';

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate!: string;

  @IsIn(['SINGLE', 'MARRIED', 'DIVORCED'])
  maritalStatus!: 'SINGLE' | 'MARRIED' | 'DIVORCED';

  @IsIn(COUNTRY_CODES)
  mobileCountry!: (typeof COUNTRY_CODES)[number];

  @Matches(/^\d{6,15}$/)
  mobile!: string;

  @IsString()
  @MaxLength(254)
  personalEmail!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  address!: string;
}
