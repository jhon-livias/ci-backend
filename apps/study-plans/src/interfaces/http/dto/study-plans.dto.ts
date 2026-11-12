import { IsInt, IsNumber, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateCurriculumDto {
  @IsUUID()
  careerId!: string;

  @IsUUID()
  modalityId!: string;

  @Matches(/^20\d{2}$/u)
  year!: string;
}

export class CreateCycleDto {
  @IsInt()
  @Min(1)
  @Max(20)
  number!: number;
}

export class SaveCourseDto {
  @IsInt()
  @Min(1)
  @Max(40)
  position!: number;

  @Matches(/^[A-Z]{2}\d{3}$/u)
  code!: string;

  @IsString()
  @Length(3, 180)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(20)
  credits!: number;
}

export class UploadSyllabusDto {
  @IsString()
  @MaxLength(12_000_000)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/u)
  contentBase64!: string;
}
