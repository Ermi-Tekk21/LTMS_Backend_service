import { IsString, IsUUID, IsNumber, IsArray, ArrayNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { participant_type } from 'src/common/constants/enums';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsUUID()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_number: number;

  @IsOptional()
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  woreda?: string;

  @IsOptional()
  @IsString()
  clusterId?: string;


  @IsString()
  venue: string;

  @IsString()
  description: string;

  @IsEnum(participant_type)
  participant_type: participant_type[];

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
