import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateIf } from 'class-validator';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class SaveAreaDto {
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsUUID('4', { message: 'El área superior no es válida.' })
  parentId?: string | null;
  @trim() @IsString() @Matches(/^[A-Z]{2,6}$/u, { message: 'Las siglas del área deben tener entre 2 y 6 letras.' })
  code!: string;
  @trim() @IsString() @Length(3, 160, { message: 'El nombre del área debe tener al menos 3 caracteres.' }) name!: string;
  @trim() @IsString() @MaxLength(400, { message: 'La responsabilidad es demasiado larga.' }) responsibility!: string;
  @trim() @IsString() @Length(3, 160, { message: 'Escribe el nombre del responsable.' }) managerName!: string;
  @trim() @IsString() @Matches(/^\d{8}$/u, { message: 'El DNI del responsable debe tener 8 dígitos.' }) managerDocument!: string;
  @trim() @IsEmail({}, { message: 'El correo del responsable no es válido.' }) managerEmail!: string;
  @IsBoolean() receivesTickets!: boolean;
  @IsBoolean() allowsInternal!: boolean;
  @IsBoolean() canCreateTickets!: boolean;
  @IsBoolean() enabled!: boolean;
}

export class SaveCategoryDto {
  @IsUUID('4', { message: 'Elige un área válida.' }) areaId!: string;
  @trim() @IsString() @Length(3, 160, { message: 'El nombre de la categoría debe tener al menos 3 caracteres.' }) name!: string;
  @trim() @IsString() @MaxLength(400, { message: 'La descripción de la categoría es demasiado larga.' }) description!: string;
  @IsBoolean({ message: 'Indica si la categoría está activa.' }) enabled!: boolean;
}

export class SaveMemberDto {
  @trim() @IsString() @Length(3, 160, { message: 'Escribe los nombres y apellidos.' }) fullName!: string;
  @trim() @IsString() @Matches(/^\d{8}$/u, { message: 'El DNI debe tener 8 dígitos.' }) document!: string;
  @trim() @IsString() @Length(3, 160, { message: 'Escribe el cargo.' }) roleTitle!: string;
  @trim() @IsEmail({}, { message: 'El correo institucional no es válido.' }) email!: string;
  @trim() @IsString() @MaxLength(20, { message: 'El teléfono es demasiado largo.' }) phone!: string;
  @trim() @IsString() @MaxLength(400, { message: 'Las funciones son demasiado largas.' }) functions!: string;
  @trim() @IsString() @MaxLength(200, { message: 'El horario es demasiado largo.' }) schedule!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true, message: 'Una de las áreas elegidas no es válida.' })
  areaIds?: string[];
}

export class AddPriorityActivityDto {
  @IsIn(['HIGH', 'MEDIUM', 'LOW']) level!: 'HIGH' | 'MEDIUM' | 'LOW';
  @trim() @IsString() @Length(3, 160) categoryName!: string;
  @trim() @IsString() @Length(3, 240) activity!: string;
  @trim() @IsString() @Length(1, 80) estimate!: string;
}
