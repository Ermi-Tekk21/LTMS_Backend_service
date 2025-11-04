import {
  IsUUID,
  IsNumber,
  ValidateNested,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEventDateDto } from '../schedule/dto/create-event-date.dto';

export class CreateEventDto {
  @IsUUID()
  name: string;

  @IsString()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_no: number;

  @ValidateNested({ each: true })
  @Type(() => CreateEventDateDto)
  event_dates: CreateEventDateDto[];
}
