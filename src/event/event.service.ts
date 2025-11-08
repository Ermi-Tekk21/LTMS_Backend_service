import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, QueryRunner } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { DocumentService } from './document/document.service';
import { doc_type } from 'src/common/enums/status_enums';
import { TrainerService } from './trainer/trainer.service';
import { Trainer } from './trainer/entities/trainer.entity';

@Injectable()
export class EventService {
  constructor(
    private readonly eventDAL: EventDAL,
    private readonly documentService: DocumentService,
    private readonly eventDateService: EventDateService,
    private readonly eventSessionService: EventSessionService,
    private readonly trainerService: TrainerService,
    private readonly awsS3Service: AwsS3Service,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateEventDto, file: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      const folder = 'TOR';

      const event = await this.eventDAL.create({
        project_id: dto.project_id,
        type: dto.type,
        name: dto.name,
        location: dto.location,
        venue: dto.venue,
        expected_participant_number: dto.expected_participant_no,
      }, queryRunner);

      const uploadedFile = await this.awsS3Service.uploadFile(
        file,
        bucketName,
        folder,
        event.id as string,
      );

      await this.documentService.create({
        event,
        path: uploadedFile.key,
        file_type: file.mimetype.split('/')[1],
        doc_type: doc_type.TOR,
      }, queryRunner);

      for (const date of dto.event_dates || []) {
        const eventDate = await this.eventDateService.create(
          { date, event },
          queryRunner,
        );
        await this.eventSessionService.create({
          event_date: eventDate,
          venue: event.venue,
        }, queryRunner);
      }

      if (dto.trainers?.length) {
        const trainers: Trainer[] = [];
        for (const trainerId of dto.trainers) {
          const trainer = await this.trainerService.findOne(trainerId);
          if (!trainer) {
            throw new NotFoundException(`Trainer with ID ${trainerId} not found`);
          }
          trainers.push(trainer);
        }
        event.trainers = trainers;
      }

      await queryRunner.manager.save(event);

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Event created successfully',
        data: {
          event,
          torDocument: uploadedFile,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }


  async findAll() {
    return await this.eventDAL.findAll();
  }

  viewDoc() {
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    console.log("bucket name: ", bucketName);

    return this.awsS3Service.getPresignedUrl(bucketName, "trainers/0ad4fb94-1289-4963-8249-555ea52c49e0.png")
  }

  async findOne(id: string) {
    return await this.eventDAL.findOne({
      where: { id: id },
      relations: ['trainers', 'documents', 'participants']
    })
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
