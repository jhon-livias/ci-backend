import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class SaveAreaDto {
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsUUID()
  parentId?: string | null;
  @trim() @IsString() @Matches(/^[A-Z]{2,6}$/u, { message: 'Las siglas del área deben tener entre 2 y 6 letras.' })
  code!: string;
  @trim() @IsString() @Length(3, 160) name!: string;
  @trim() @IsString() @MaxLength(400) responsibility!: string;
  @trim() @IsString() @MaxLength(160) managerName!: string;
  @trim() @IsString() @MaxLength(12) managerDocument!: string;
  @trim() @IsEmail() managerEmail!: string;
  @IsBoolean() receivesTickets!: boolean;
  @IsBoolean() allowsInternal!: boolean;
  @IsBoolean() canCreateTickets!: boolean;
  @IsBoolean() enabled!: boolean;
}

export class SaveCategoryDto {
  @IsUUID() areaId!: string;
  @trim() @IsString() @Length(3, 160) name!: string;
  @trim() @IsString() @MaxLength(400) description!: string;
  @IsBoolean() enabled!: boolean;
}

export class SaveMemberDto {
  @trim() @IsString() @Length(3, 160) fullName!: string;
  @trim() @IsString() @Matches(/^\d{8}$/u, { message: 'El DNI debe tener 8 dígitos.' }) document!: string;
  @trim() @IsString() @Length(3, 160) roleTitle!: string;
  @trim() @IsEmail() email!: string;
  @trim() @IsString() @MaxLength(20) phone!: string;
  @trim() @IsString() @MaxLength(400) functions!: string;
  @trim() @IsString() @MaxLength(200) schedule!: string;
}

export class AddPriorityActivityDto {
  @IsIn(['HIGH', 'MEDIUM', 'LOW']) level!: 'HIGH' | 'MEDIUM' | 'LOW';
  @trim() @IsString() @Length(3, 160) categoryName!: string;
  @trim() @IsString() @Length(3, 240) activity!: string;
  @trim() @IsString() @Length(1, 80) estimate!: string;
}
