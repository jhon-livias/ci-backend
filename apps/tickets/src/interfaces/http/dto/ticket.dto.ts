import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class CreateExternalTicketDto {
  @IsUUID() areaId!: string;
  @IsIn(['self', 'student', 'teacher']) about!: 'self' | 'student' | 'teacher';
  @trim() @IsOptional() @IsString() @MaxLength(160) otherName?: string;
  @trim() @IsOptional() @IsString() @Matches(/^$|^\d{8}$/u) otherDocument?: string;
  @IsUUID() categoryId!: string;
  @trim() @IsString() @Length(10, 4000) description!: string;
  @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(200, { each: true })
  attachmentNames!: string[];
}

export class CreateInternalTicketDto {
  @trim() @IsString() @Length(3, 160) assignedName!: string;
  @trim() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/u) dueOn!: string;
  @IsIn(['HIGH', 'MEDIUM', 'LOW']) priority!: 'HIGH' | 'MEDIUM' | 'LOW';
  @trim() @IsString() @Length(3, 160) categoryName!: string;
  @trim() @IsString() @Length(10, 4000) description!: string;
  @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(200, { each: true })
  attachmentNames!: string[];
}

export class ChangeTicketStatusDto {
  @IsIn(['CREATED', 'IN_REVIEW', 'RETURNED', 'RESOLVED', 'DERIVED', 'REOPENED'])
  status!: 'CREATED' | 'IN_REVIEW' | 'RETURNED' | 'RESOLVED' | 'DERIVED' | 'REOPENED';
  @trim() @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @trim() @IsOptional() @IsString() @MaxLength(160) assignedName?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) @MaxLength(200, { each: true })
  attachmentNames?: string[];
}

export class UpdateInternalTicketDto {
  @trim() @IsString() @Length(3, 160) assignedName!: string;
  @trim() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/u) dueOn!: string;
  @IsIn(['HIGH', 'MEDIUM', 'LOW']) priority!: 'HIGH' | 'MEDIUM' | 'LOW';
  @trim() @IsString() @Length(3, 160) categoryName!: string;
  @trim() @IsString() @Length(10, 4000) description!: string;
}

export class ReopenTicketDto {
  @trim() @IsString() @Length(8, 4000) reason!: string;
}
