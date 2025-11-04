import {
  IsUUID,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEventDateDto } from '../schedule/dto/create-event-date.dto';

export class CreateEventDto {
  @IsUUID()
  name: string;

  @IsUUID()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_no: number;

  @ValidateNested({ each: true })
  @Type(() => CreateEventDateDto)
  event_dates: CreateEventDateDto[];
}
