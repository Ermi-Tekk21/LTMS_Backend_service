import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFiles ,Query} from '@nestjs/common';
import { DocumentService } from './document.service';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { multerOptions } from 'src/common/fileHandler/MulterOption';
import { FilesInterceptor } from '@nestjs/platform-express';
import { doc_type } from 'src/common/enums/status_enums';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('document')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService
  ) { }

  @Post('upload/:eventId')
  @UseInterceptors(FilesInterceptor('docs', 10, multerOptions(true, ['pdf', 'image', 'vid'], 30)))
  create(
    @CurrentUser() user: any,
    @Body('doc-type') docType: doc_type,
    @Param('eventId') eventId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    return this.documentService.createAndUploadMultipleFile(files, eventId, docType, bucketName,user.userId);
  }

@Get('/view')
viewDoc(@Query('key') key: string) {
  return this.documentService.viewDoc(key);
}


  @Get()
  findAll() {
    return this.documentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDocumentDto: UpdateDocumentDto, @CurrentUser() user: any,) {
    return this.documentService.update(+id, updateDocumentDto,);//user.userId
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any,) {
    return this.documentService.remove(id,user.userId);
  }
}
