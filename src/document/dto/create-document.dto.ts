import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { doc_type } from 'src/common/constants/enums';

export class CreateDocumentDto {
  @IsString()
  path: string;

  @IsString()
  file_type: string;

  @IsEnum(doc_type)
  doc_type: doc_type;

  @IsOptional()
  @IsUUID()
  event_id?: string;

  @IsOptional()
  @IsUUID()
  activity_id?: string;
}
