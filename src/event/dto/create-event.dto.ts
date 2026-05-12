import { IsString, IsUUID, IsNumber, IsArray, ArrayNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { participant_type } from 'src/common/constants/enums';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_number: number;

  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsUUID()
  newLocationId: string;

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

  @IsOptional()
  @IsUUID()
  clusterId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  woredaId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
