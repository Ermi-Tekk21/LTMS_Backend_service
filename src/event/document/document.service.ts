import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DeepPartial } from 'typeorm';
import { QueryRunner } from 'typeorm';
import { DocumentDAL } from './dal/document.dal';
import { Document } from './entities/document.entity';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { EventService } from '../event.service';
import { doc_type } from 'src/common/enums/status_enums';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentDal: DocumentDAL,
    private readonly awsS3Service: AwsS3Service,
    @Inject(forwardRef(() => EventService))
    private eventService: EventService,
  ) { }

  async create(data: DeepPartial<Document>, queryRunner?: QueryRunner) {
    try {
      return await this.documentDal.create(data, queryRunner)
    } catch (error) {
      throw new Error(`EventDateService.create failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createAndUploadMultipleFile(files: Express.Multer.File[], eventID: string, fileType: doc_type, bucketName: string) {
    try {
      const uploadedFiles = await this.awsS3Service.uploadMultipleFiles(files, bucketName, fileType);
      const event = await this.eventService.findOne(eventID)
      if (!event) {
        throw new NotFoundException('not found')
      }
      // uploadedFiles contains { key, url } while the original `files` array has the mimetype,
      // so map by index to get the original mimetype.
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploaded = uploadedFiles[i];
        const original = files[i];
        await this.create({
          event,
          path: uploaded.key,
          file_type: original?.mimetype?.split('/')[1] ?? '',
          doc_type: fileType,
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  findAll() {
    return `This action returns all document`;
  }

  viewDoc(key: string) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    return this.awsS3Service.getPresignedUrl(bucketName, key)
  }

  findOne(id: number) {
    return `This action returns a #${id} document`;
  }

  update(id: number, updateDocumentDto: UpdateDocumentDto) {
    return `This action updates a #${id} document`;
  }

  remove(id: number) {
    return `This action removes a #${id} document`;
  }
}
