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
  @IsString()
  location_id?: string;

  @IsOptional()
  @IsUUID()
  Newlocation_id?: string;

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
