import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 254)
  readonly username!: string;

  @IsString()
  @Length(8, 128)
  @Matches(/\S/, { message: 'La contraseña no puede contener solo espacios.' })
  readonly password!: string;
}
