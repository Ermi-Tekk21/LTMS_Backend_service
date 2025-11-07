import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, QueryRunner } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { DocumentService } from './document/document.service';
import { doc_type } from 'src/common/enums/status_enums';

@Injectable()
export class EventService {
  constructor(
    private readonly eventDAL: EventDAL,
    private readonly documentService: DocumentService,
    private readonly eventDateService: EventDateService,
    private readonly eventSessionService: EventSessionService,
    private readonly awsS3Service: AwsS3Service,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateEventDto, file: Express.Multer.File) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      const folder = 'TOR';
      
      // const uploadedFile = await this.awsS3Service.uploadFile(file, bucketName, folder);

      const event = await this.eventDAL.create(dto, queryRunner);

      await this.documentService.create({
        event: event,
        path: `${folder}.${file.originalname.replaceAll(' ', '_')}`,
        file_type: file.mimetype.split('/')[1],
        doc_type: doc_type.TOR,
      }, queryRunner);

      for (const dateDto of dto.event_dates || []) {
        const eventDate = await this.eventDateService.create(
          { ...dateDto, event: event },
          queryRunner,
        );

        for (const sessionDto of dateDto.date_sessions || []) {
          await this.eventSessionService.create(
            { ...sessionDto, event_date: eventDate },
            queryRunner,
          );
        }
      }

      await queryRunner.commitTransaction();
      return {
        message: 'Event created successfully',
        event,
        // torDocument: uploadedFile,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  findAll() {
    return `This action returns all event`;
  }

  findOne(id: string) {
    return `This action returns a #${id} event`;
  }

  update(id: string, updateEventDto: UpdateEventDto) {
    return `This action updates a #${id} event`;
  }

  async remove(id: string) {
    try {
      const result = await this.eventDAL.delete(id);
      return {
        success: true,
        message: 'Event removed successfully',
        id,
        result,
      };
    } catch (err) {
      throw new Error(
        `Failed to remove event ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
