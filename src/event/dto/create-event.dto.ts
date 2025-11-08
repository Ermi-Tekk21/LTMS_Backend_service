import { IsString, IsUUID, IsNumber, IsArray, ArrayNotEmpty, IsOptional } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsUUID()
  type: string;

  @IsUUID()
  project_id: string;

  @IsNumber()
  expected_participant_no: number;

  @IsString()
  location: string;

  @IsString()
  venue: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  trainers: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  event_dates: string[];
}
