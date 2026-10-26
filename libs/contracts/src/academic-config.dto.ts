import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

import { ACADEMIC_CATALOG_KINDS, type AcademicCatalogKind } from './academic-config.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class AcademicCatalogItemDto {
  @IsIn(ACADEMIC_CATALOG_KINDS)
  kind!: AcademicCatalogKind;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[^<>]+$/u)
  name!: string;
}

export class AcademicRulesDto {
  @IsInt() @Min(0) @Max(500)
  minStudents!: number;

  @IsInt() @Min(0) @Max(500)
  maxStudents!: number;

  @IsInt() @Min(0) @Max(100)
  absencePercent!: number;

  @IsInt() @Min(0) @Max(100)
  passingGrade!: number;

  @IsInt() @Min(1) @Max(20)
  evaluationsPerGroup!: number;

  @IsInt() @Min(1) @Max(100)
  maxScorePerEvaluation!: number;
}
