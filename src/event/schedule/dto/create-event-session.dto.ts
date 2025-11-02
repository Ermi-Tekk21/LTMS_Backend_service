import { IsDateString, IsEnum,  IsString, IsUUID, IsArray } from 'class-validator';
import { doc_type } from 'src/common/enums/status_enums';

export class CreateEventSessionDto {
  @IsString()
  agenda: string;

  @IsDateString()
  starts_at: Date;

  @IsDateString()
  ends_at: Date;

  @IsEnum(doc_type)
  doc_type: doc_type;

  @IsUUID()
  event_date_id: string;

  @IsArray()
@IsUUID('all', { each: true })
trainer_ids: string[];


}
