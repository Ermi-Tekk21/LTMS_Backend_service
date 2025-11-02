import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentDto } from './create-document.dto';
import { IsUUID } from 'class-validator';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {
  @IsUUID()
  id: string;

}
