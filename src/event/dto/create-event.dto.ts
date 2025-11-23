import { IsString, IsUUID, IsNumber, IsArray, ArrayNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsUUID()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_number: number;

  @IsString()
  location_id: string;

  @IsString()
  venue: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  trainers: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  event_dates: string[];

  @IsOptional()
  @IsBoolean()
  is_day_based: boolean;
}
