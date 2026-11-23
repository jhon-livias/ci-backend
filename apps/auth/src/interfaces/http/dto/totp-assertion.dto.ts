import { IsString, IsUUID, Matches } from 'class-validator';

export class TotpAssertionDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @Matches(/^\d{6}$/u)
  code!: string;
}
