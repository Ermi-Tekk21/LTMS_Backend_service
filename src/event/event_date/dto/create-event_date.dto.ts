import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEventSessionDto } from 'src/event/event_session/dto/create-event_session.dto';

export class CreateEventDateDto {
  @IsOptional()
  @IsString()
  agenda?: string;

  @IsDateString()
  date: Date;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEventSessionDto)
  date_sessions: CreateEventSessionDto[];
}
