import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestPasswordRecoveryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  email!: string;
}

export class ConfirmPasswordRecoveryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  email!: string;

  @IsString()
  @Matches(/^\d{8}$/u, { message: 'Revisa el código e inténtalo nuevamente.' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  @Matches(/^[^<>]{8,72}$/u, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password!: string;
}
