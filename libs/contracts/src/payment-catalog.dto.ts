import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateTariffDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9_999_999)
  amountCents!: number;
}
