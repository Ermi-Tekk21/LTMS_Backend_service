import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsUUID, IsString, IsNumber, IsArray, IsEnum, ArrayNotEmpty } from 'class-validator';
import { event_status, participant_type } from 'src/common/constants/enums';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  type?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsEnum(event_status)
  event_status?: event_status;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  expected_participant_number?: number;

  @IsOptional()
  @IsEnum(participant_type)
  participant_type?: participant_type[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  trainers: string[];

  @IsOptional()
  @IsUUID()
  location_id?: string;

  @IsOptional()
  @IsUUID()
  region_id?: string;

  @IsOptional()
  @IsUUID()
  zone_id?: string;

  @IsOptional()
  @IsUUID()
  woreda_id?: string;

  @IsOptional()
  @IsUUID()
  clusterId?: string;

  @IsOptional()
  @IsString()
  location?: string;


  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  event_dates?: string[];
}
