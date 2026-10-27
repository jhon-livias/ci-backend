import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 254)
  readonly username!: string;

  @IsString()
  @Length(8, 128)
  @Matches(/\S/, { message: 'La contraseña no puede contener solo espacios.' })
  readonly password!: string;

  /** Token efímero emitido por reCAPTCHA v3 para la acción de inicio de sesión. */
  @IsString()
  @Length(20, 4096)
  readonly recaptchaToken!: string;
}
