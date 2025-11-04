import {
  IsUUID,
  IsNumber,
  ValidateNested,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEventDateDto } from '../event_date/dto/create-event_date.dto';

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
