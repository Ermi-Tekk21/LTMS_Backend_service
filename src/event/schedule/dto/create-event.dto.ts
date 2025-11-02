import { IsDateString, IsEnum, IsString, IsUUID } from 'class-validator';
import { doc_type } from 'src/common/enums/status_enums';

export class CreateEventDateDto {
  @IsString()
  agenda: string;

  @IsDateString()
  date: Date;

  @IsEnum(doc_type)
  doc_type: doc_type;

  @IsUUID()
  event_id: string;

}
