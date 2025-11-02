import { IsEnum, IsDateString } from 'class-validator';
import { event_status } from 'src/shared/enums/status_enums';

export class CreateEventDto {
  @IsDateString()
  due_date: Date;

  @IsEnum(event_status)
  event_status: event_status;

}
