import {
  IsUUID,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateEventDateDto } from '../schedule/dto/update-event-date.dto';

export class UpdateEventDto {
  @IsOptional()
  @IsUUID()
  name?: string;

  @IsOptional()
  @IsUUID()
  type?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsNumber()
  expected_participant_no?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateEventDateDto)
  event_dates?: UpdateEventDateDto[];
}
