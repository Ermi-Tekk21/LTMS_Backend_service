import { forwardRef, Inject, Injectable, NotFoundException, UploadedFiles } from '@nestjs/common';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DeepPartial, Repository } from 'typeorm';
import { QueryRunner } from 'typeorm';
import { DocumentDAL } from './dal/document.dal';
import { Document } from './entities/document.entity';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { EventService } from '../event.service';
import { doc_type, event_status } from 'src/common/enums/status_enums';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,

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

  async createAndUploadMultipleFile(files: Express.Multer.File[], eventID: string, docType: doc_type, bucketName: string) {
    try {
      const doctype = docType.toLocaleLowerCase()
      const uploadedFiles = await this.awsS3Service.uploadMultipleFiles(files, bucketName, doctype);

      const event = await this.eventService.findOne(eventID)
      if (!event) {
        throw new NotFoundException('not found')
      }
      if (doctype == doc_type.REPORT) {
        event.event_status = event_status.CLOSED
        await this.eventRepo.save(event)
        console.log(
          `[${new Date().toISOString()}] Event ${eventID} (${event?.name ?? 'untitled'}) marked as ${event.event_status} after uploading ${uploadedFiles.length} ${uploadedFiles.length === 1 ? 'file' : 'files'} to bucket "${bucketName}" (docType=${doctype})`
        );
      }

      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploaded = uploadedFiles[i];
        const original = files[i];
        await this.create({
          event,
          path: uploaded.key,
          file_type: original?.mimetype?.split('/')[1] ?? '',
          doc_type: doctype as doc_type,
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

  async remove(id: string, queryRunner?: QueryRunner) {
    try {
      const document = await this.documentDal.findOne({
        where: {
          id: id
        }
      });
      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      if (document.path) {
        try {
          await this.awsS3Service.deleteFile(bucketName, document.path);
        } catch (s3Err) {
          console.warn(`Failed to delete S3 object ${document.path}:`, s3Err);
        }
      }

      await this.documentDal.delete(document, queryRunner);
      return true;
    } catch (error) {
      throw new Error(`DocumentService.remove failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
