import { IsBoolean } from 'class-validator';

export class RequireTotpDto {
  @IsBoolean()
  required!: boolean;
}
