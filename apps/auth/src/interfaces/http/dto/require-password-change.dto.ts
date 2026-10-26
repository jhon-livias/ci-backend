import { IsBoolean } from 'class-validator';

export class RequirePasswordChangeDto {
  @IsBoolean()
  mustChangePassword!: boolean;
}
