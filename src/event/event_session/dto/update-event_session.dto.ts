import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

export class UpdateEventSessionDto {
  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsDateString()
  starts_at?: Date;

  @IsOptional()
  @IsDateString()
  ends_at?: Date;

  @IsOptional()
  @IsUUID()
  event_date_id?: string;

  @IsOptional()
  @IsString()
  venue?: string;
}
