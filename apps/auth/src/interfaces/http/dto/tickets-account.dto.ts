import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches } from 'class-validator';

const trim = () => Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export class ProvisionTicketsAccountDto {
  @trim() @IsString() email!: string;
  @trim() @IsString() @Matches(/^\d{8}$/u) documentNumber!: string;
  @trim() @IsString() fullName!: string;
  @trim() @IsOptional() @IsString() phone?: string;
  @IsArray() @ArrayMinSize(1) @IsIn(['tickets.area_manager', 'tickets.assistant', 'tickets.requester'], { each: true })
  roles!: ('tickets.area_manager' | 'tickets.assistant' | 'tickets.requester')[];
}
