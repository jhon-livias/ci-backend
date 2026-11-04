import { IsIn, Matches } from 'class-validator';

export class UpdateAccountContactDto {
  @IsIn(['+51', '+1', '+52', '+54', '+56', '+57', '+58', '+593', '+34'])
  mobileCountry!: '+51' | '+1' | '+52' | '+54' | '+56' | '+57' | '+58' | '+593' | '+34';

  @Matches(/^\d{6,15}$/)
  mobile!: string;
}
