import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsUUID, IsString, IsNumber, IsArray, IsEnum, ArrayNotEmpty, IsBoolean } from 'class-validator';
import { event_status, participant_type } from 'src/common/constants/enums';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsNumber()
  expected_participant_number?: number;

  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsOptional()
  @IsUUID()
  newLocationId?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(event_status)
  event_status?: event_status;

  @IsOptional()
  @IsEnum(participant_type)
  participant_type?: participant_type[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  trainers?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  event_dates?: string[];

  @IsOptional()
  @IsBoolean()
  is_day_based?: boolean;

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
