import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @MessagePattern('createDocument')
  create(@Payload() createDocumentDto: CreateDocumentDto) {
    return this.documentService.create(createDocumentDto);
  }

  @MessagePattern('findAllDocument')
  findAll() {
    return this.documentService.findAll();
  }

  @MessagePattern('findOneDocument')
  findOne(@Payload() id: number) {
    return this.documentService.findOne(id);
  }

  @MessagePattern('updateDocument')
  update(@Payload() updateDocumentDto: UpdateDocumentDto) {
    return this.documentService.update(updateDocumentDto.id, updateDocumentDto);
  }

  @MessagePattern('removeDocument')
  remove(@Payload() id: number) {
    return this.documentService.remove(id);
  }
}
