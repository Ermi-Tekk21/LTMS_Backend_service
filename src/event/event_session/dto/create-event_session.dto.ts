import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEventSessionDto {
  @IsOptional()
  @IsString()
  agenda: string;

  @IsOptional()
  @IsDateString()
  starts_at: Date;

  @IsOptional()
  @IsDateString()
  ends_at: Date;

  @IsUUID()
  event_date_id: string;

  @IsOptional()
  @IsString()
  venue: string;
}
