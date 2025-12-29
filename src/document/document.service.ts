import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import { QueryRunner } from 'typeorm';
import { DocumentDAL } from './dal/document.dal';
import { Document } from './entities/document.entity';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { EventService } from 'src/event/event.service';
import { doc_type, event_status } from 'src/common/constants/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Event } from 'src/event/entities/event.entity';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,

    private readonly documentDal: DocumentDAL,
    private readonly awsS3Service: AwsS3Service,

    @Inject(forwardRef(() => EventService))
    private readonly eventService: EventService,
  ) { }

  async create(data: DeepPartial<Document>, queryRunner?: QueryRunner) {
    try {
      return await this.documentDal.create(data, queryRunner);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create document: ${error.message}`,
      );
    }
  }

  async createAndUploadMultipleFile(
    files: Express.Multer.File[],
    eventID: string,
    docType: doc_type,
    bucketName: string,
    userId: string
  ) {
    const doctype = docType.toLowerCase();

    try {
      const event = await this.eventService.findOne(eventID);
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      if (doctype === doc_type.REPORT) {
        this.ensureReportUploadAllowed(event);
      }

      const uploadedFiles = await this.awsS3Service.uploadMultipleFiles(
        files,
        bucketName,
        doctype,
      );

      if (doctype === doc_type.REPORT) {
        event.event_status = event_status.COMPLATED;
        await this.eventRepo.save(event);
      }

      for (let i = 0; i < uploadedFiles.length; i++) {
        const uploaded = uploadedFiles[i];
        const original = files[i];

        await this.create({
          event,
          path: uploaded.key,
          file_type: original?.mimetype?.split('/')[1] ?? '',
          doc_type: doctype as doc_type,
          created_by: userId
        });
      }

      return true;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to upload files: ${err.message}`,
      );
    }
  }

  private ensureReportUploadAllowed(event: Event) {
    const lastDate = event.event_dates
      .map((e) => new Date(e.date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const now = new Date();

    if (now.getTime() < lastDate.getTime()) {
      throw new BadRequestException(
        'Cannot upload report: current date is before the last event date',
      );
    }
  }

  async createLink(
    link: string,
    eventID: string,
    docType: doc_type,
    userId: string
  ) {
    const doctype = docType.toLowerCase();

    try {
      const event = await this.eventService.findOne(eventID);
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      if (doctype === doc_type.REPORT) {
        this.ensureReportUploadAllowed(event);
      }

      if (doctype === doc_type.REPORT) {
        event.event_status = event_status.COMPLATED;
        await this.eventRepo.save(event);
      }

      const newDoc = await this.create({
        event,
        path: link, // Store the link directly as the path
        file_type: 'link', // Special file type for links
        doc_type: doctype as doc_type,
        created_by: userId
      });

      return newDoc;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to save link: ${err.message}`,
      );
    }
  }

  async remove(id: string, queryRunner?: QueryRunner, userId?: string) {
    try {
      const document = await this.documentDal.findOne({ where: { id } });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const bucketName = process.env.AWS_S3_BUCKET_NAME!;

      // try deleting S3 file but do not stop if it fails
      if (document.path) {
        try {
          await this.awsS3Service.deleteFile(bucketName, document.path);
        } catch (s3Err) {
          console.warn(`S3 delete failed for ${document.path}:`, s3Err);
        }
      }
      await this.documentDal.delete(document.id);
      return {
        success: true,
        message: "the document has been successfully deleted."
      };
    } catch (err) {
      console.log(err);

      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(`Failed to remove document`);
    }
  }

  async viewDoc(key: string) {
    // If the key is an external link (starts with http/https), return it directly
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    return this.awsS3Service.getPresignedUrl(bucketName, key);
  }
}
