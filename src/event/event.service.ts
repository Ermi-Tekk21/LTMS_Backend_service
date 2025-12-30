import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, In, Repository } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { DocumentService } from 'src/document/document.service';
import { attendance, doc_type, event_status, participant_type, reportType, session_type } from 'src/common/constants/enums';
import { Trainer } from './trainer/entities/trainer.entity';
import { Event } from './entities/event.entity';
import { Participant } from './participant/entities/participant.entity';
import { EmailService } from 'src/common/notification/email.service';
import { QueryRunner } from 'typeorm/browser';
import PdfPrinter from 'pdfmake';
import * as path from 'path';
import * as fs from 'fs';
import { UUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EventSession } from './event_session/entities/event_session.entity';
import { SessionParticipantMap } from './participant/entities/sessionParticipantMap.entity';
import { CapitalizeInterceptor } from 'src/common/database/capitalize-response.interceptor';
import axios from 'axios';
import { capitalizeFirstLetter } from 'node_modules/graphql-request/build/lib/prelude';
import { UpdateDateParticipantStatusDto, UpdateSessionParticipantStatusDto } from './event_session/dto/update-manual-att.dto';
import { report } from 'process';
// import { ParticipantService } from './participant/participant.service';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,

    @InjectRepository(SessionParticipantMap)
    private readonly sessionParticipantMapRepo: Repository<SessionParticipantMap>,

    private readonly eventDAL: EventDAL,
    private readonly documentService: DocumentService,
    private readonly eventDateService: EventDateService,
    private readonly eventSessionService: EventSessionService,
    private readonly awsS3Service: AwsS3Service,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateEventDto, file: Express.Multer.File, created_by: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      const folder = 'tor';

      const event = await this.eventDAL.create({
        project_id: dto.project_id,
        type: dto.type,
        name: dto.name,
        location_id: dto.location_id,
        venue: dto.venue,
        expected_participant_number: dto.expected_participant_number,
        is_day_based: dto.is_day_based,
        participant_type: dto.participant_type,
        description: dto.description,
        created_by,
      }, queryRunner);

      const uploadedFile = await this.awsS3Service.uploadFile(
        file,
        bucketName,
        folder,
        event.id,
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
        const morningStart = new Date(date);
        morningStart.setHours(9, 0, 0, 0);

        const morningEnd = new Date(date);
        morningEnd.setHours(12, 0, 0, 0);

        const afternoonStart = new Date(date);
        afternoonStart.setHours(13, 0, 0, 0);

        const afternoonEnd = new Date(date);
        afternoonEnd.setHours(17, 0, 0, 0);

        // morning session
        const morningSession = await this.eventSessionService.create({
          event_date: eventDate,
          venue: event.venue,
          starts_at: morningStart,
          ends_at: morningEnd,
          session_type: session_type.MORNING
        }, queryRunner);

        //afternoon session
        const afternoonSession = await this.eventSessionService.create({
          event_date: eventDate,
          venue: event.venue,
          starts_at: afternoonStart,
          ends_at: afternoonEnd,
          session_type: session_type.AFTERNOON
        }, queryRunner);

      }
      await queryRunner.manager.save(event);
      await queryRunner.commitTransaction();


      if (dto.trainers?.length) {
        const trainers = dto.trainers
        await this.assignTrainersToEvent(event.id, trainers)
      }

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
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to create event: ${error instanceof Error ? error.message : String(error)}`
      );

    } finally {
      await queryRunner.release();
    }
  }

  async replaceTOR(id: UUID, file: Express.Multer.File, updated_by: string, queryRunner?: QueryRunner) {
    let ownTransaction = false;
    if (!queryRunner) {
      queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      ownTransaction = true;
    }

    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      const folder = 'tor';

      const event = await this.findOne(String(id));
      if (!event) {
        throw new NotFoundException(`Event not found`);
      }
      if (event.event_status != event_status.INITATED) {
        throw new BadRequestException(
          `Cannot replace TOR for event ${event.id}: event must be in '${event_status.INITATED}' status (current: '${event.event_status}').`
        );
      }
      const torDoc = event.documents.find(d => d.doc_type === doc_type.TOR);

      if (torDoc) {
        await this.documentService.remove(torDoc.id);
      }
      const uploadedFile = await this.awsS3Service.uploadFile(
        file,
        bucketName,
        folder,
        event.id as string,
      );

      await this.documentService.create({
        updated_by,
        event,
        path: uploadedFile.key,
        file_type: file.mimetype.split('/')[1],
        doc_type: doc_type.TOR,
      }, queryRunner);

      // No dto here - replaceTOR only replaces the TOR document.
      await queryRunner.manager.save(event);

      if (ownTransaction) {
        await queryRunner.commitTransaction();
      }
    } catch (error) {
      if (ownTransaction) {
        await queryRunner.rollbackTransaction();
      }
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to replace TOR for event: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      if (ownTransaction) {
        await queryRunner.release();
      }
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto, updated_by: string, file?: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const event = await this.findOne(id)
      if (!event) {
        throw new NotFoundException('event to be updated not found...')
      }

      const { trainers, event_dates, ...eventData } = updateEventDto;

      // Update scalar properties - map DTO fields to entity properties
      if (Object.keys(eventData).length > 0) {
        const updateData: any = { ...eventData };
        if (updateData.status !== undefined) {
          updateData.event_status = updateData.status;
          delete updateData.status;
        }
        await this.eventDAL.update(id, { ...updateData, updated_by }, queryRunner);
      }

      // Update event_dates relation
      if (event_dates) {
        for (const event_date of event.event_dates) {
          await this.eventDateService.remove(event_date.id)
        }
        for (const date of event_dates) {
          const eventDate = await this.eventDateService.create(
            { date, event },
            queryRunner,
          );
          const morningStart = new Date(date);
          morningStart.setHours(9, 0, 0, 0);

          const morningEnd = new Date(date);
          morningEnd.setHours(12, 0, 0, 0);

          const afternoonStart = new Date(date);
          afternoonStart.setHours(13, 0, 0, 0);

          const afternoonEnd = new Date(date);
          afternoonEnd.setHours(17, 0, 0, 0);

          // morning session
          await this.eventSessionService.create({
            event_date: eventDate,
            venue: event.venue,
            starts_at: morningStart,
            ends_at: morningEnd,
            session_type: session_type.MORNING,
          }, queryRunner);

          //afternoon session
          await this.eventSessionService.create({
            event_date: eventDate,
            venue: event.venue,
            starts_at: afternoonStart,
            ends_at: afternoonEnd,
            session_type: session_type.AFTERNOON,
          }, queryRunner);
        }
      }

      if (file) {
        await this.replaceTOR(id as UUID, file, updated_by, queryRunner)
      }

      // Update trainers if provided
      if (trainers && trainers.length > 0) {
        await this.updateTrainersForEvent(event.id, trainers);
      }

      await queryRunner.commitTransaction();

      // Return the updated event with relations
      const updatedEvent = await this.findOne(id);
      return {
        success: true,
        message: `Event ${updatedEvent?.id ?? id} updated successfully`,
        data: updatedEvent,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to update the event: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query?: {
    searchTerm?: string;
    searchFields?: string[];
    status?: event_status,
    locationId?: string,
    projectId?: string,
    page?: number;
    limit?: number;
    order?: Record<string, 'asc' | 'desc'>;
  }) {
    const options: any = {};
    options.relations = ['event_dates', 'trainers']

    if (query?.searchTerm && query?.searchFields?.length) {
      options.search = {
        term: query.searchTerm,
        fields: query.searchFields,
      };

    }
    if (query?.status) options.where = { event_status: query.status }
    if (query?.locationId) options.where = { location_id: query.locationId }
    if (query?.projectId) options.where = { project_id: query.projectId }
    if (query?.page) options.page = query.page;
    if (query?.limit) options.limit = query.limit;
    options.order = query?.order || { created_at: 'desc' };
    return this.eventDAL.findAll(options);
  }

  async participantSessionMap(eventId: string) {
    try {
      const event = await this.eventRepo.findOne({
        where: {
          id: eventId
        },
        relations: ['participants', 'event_dates', 'event_dates.event_sessions']
      })
      if (!event) {
        throw new NotFoundException('event with specified id not found.')
      }
      const participants: Participant[] = event?.participants
      const sessions: EventSession[] = event?.event_dates.flatMap(date => date?.event_sessions)

      for (const session of sessions) {
        for (const participant of participants) {
          const sessionParticipantExist = await this.sessionParticipantMapRepo.findOne({
            where: {
              participant: {
                id: participant.id
              },
              event_session: {
                id: session.id
              }
            }, relations: ['participant', 'event_session']
          })

          if (!sessionParticipantExist || session == null) {
            const sessionPaticipantMapObj = this.sessionParticipantMapRepo.create({
              participant: participant,
              event_session: session,
              attendance: {
                status: null
              }
            })
            await this.sessionParticipantMapRepo.save(sessionPaticipantMapObj)
          }
        }
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to map participants to session: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async assignTrainersToEvent(eventId: string, trainerIds: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const eventRepo = queryRunner.manager.getRepository(Event);
      const trainerRepo = queryRunner.manager.getRepository(Trainer);

      const event: any = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['trainers'],
      });

      if (!event) throw new NotFoundException('Event not found');

      // load trainers by ids
      const trainers = await trainerRepo.findBy({ id: In(trainerIds) });

      const foundIds = new Set(trainers.map((t) => t.id));
      const missing = trainerIds.filter((id) => !foundIds.has(id));
      if (missing.length) {
        throw new NotFoundException(`Trainers not found: ${missing.join(', ')}`);
      }

      // ensure event.trainers array exists and avoid duplicates
      event.trainers = event.trainers || [];
      const existingIds = new Set(event.trainers.map((t) => t.id));
      const trainersToAdd = trainers.filter((t) => !existingIds.has(t.id));

      if (trainersToAdd.length) {
        event.trainers = [...event.trainers, ...trainersToAdd];
        await eventRepo.save(event);
        for (const trainer of trainers) {
          if (trainer.email) {
            await this.emailService.sendMail(
              trainer.email,
              `You have been assigned to event: ${event.name}`,
              `Dear ${trainer.first_name}, you have been assigned to the event "${event.name}".`,
              `<p>Dear <b>${trainer.first_name}</b>,</p>
          <p>You have been assigned to the event <b>${event.name}</b>.</p>
          <p>Thank you,<br/>Event Management Team</p>`
            );
          }
        }
      }
      await queryRunner.commitTransaction();
      await this.updateEventStatusIfReady(eventId);
      // return fresh event with trainers relation
      return await eventRepo.findOne({
        where: { id: eventId },
        relations: ['trainers'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to assign trainers: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateTrainersForEvent(eventId: string, trainerIds: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const eventRepo = queryRunner.manager.getRepository(Event);
      const trainerRepo = queryRunner.manager.getRepository(Trainer);

      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['trainers'],
      });

      if (!event) throw new NotFoundException('Event not found');
      const previousTrainers = event.trainers || [];
      const newTrainers = await trainerRepo.findBy({ id: In(trainerIds) });
      const prevIds = new Set(previousTrainers.map((t) => t.id));
      const newIds = new Set(newTrainers.map((t) => t.id));

      const addedTrainers = newTrainers.filter((t) => !prevIds.has(t.id));
      const removedTrainers = previousTrainers.filter((t) => !newIds.has(t.id));

      // update event trainers
      event.trainers = newTrainers;
      const updatedEvent = await eventRepo.save(event);

      // send emails for added trainers
      for (const trainer of addedTrainers) {
        if (trainer.email) {
          await this.emailService.sendMail(
            trainer.email,
            `You have been assigned to event: ${event.name}`,
            `Dear ${trainer.first_name}, you have been assigned to the event "${event.name}".`,
            `<p>Dear <b>${trainer.first_name}</b>,</p>
           <p>You have been assigned to the event <b>${event.name}</b>.</p>
           <p>Thank you,<br/>Event Management Team</p>`
          );
        }
      }

      // send emails for removed trainers
      for (const trainer of removedTrainers) {
        if (trainer.email) {
          await this.emailService.sendMail(
            trainer.email,
            `You have been unassigned from event: ${event.name}`,
            `Dear ${trainer.first_name}, you are no longer assigned to the event "${event.name}".`,
            `<p>Dear <b>${trainer.first_name}</b>,</p>
           <p>You are no longer assigned to the event <b>${event.name}</b>.</p>
           <p>If you have any questions, please contact the admin.</p>
           <p>Thank you,<br/>Event Management Team</p>`
          );
        }
      }

      await queryRunner.commitTransaction();
      return updatedEvent;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to update trainers: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getEventTrainers(
    eventId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Trainer[]; total: number; page: number; limit: number }> {
    const eventRepo = this.dataSource.getRepository(Event);

    const event = await eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const trainerRepo = this.dataSource.getRepository(Trainer);

    const [data, total] = await trainerRepo
      .createQueryBuilder('trainer')
      .innerJoin('trainer.events', 'event', 'event.id = :eventId', { eventId })
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async removeTrainersFromEvent(eventId: string, trainerIds: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const eventRepo = queryRunner.manager.getRepository(Event);
      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['trainers'],
      });
      if (!event) throw new NotFoundException('Event not found');

      event.trainers = event.trainers.filter(
        (trainer) => !trainerIds.includes(trainer.id),
      );
      const updatedEvent = await eventRepo.save(event);

      await queryRunner.commitTransaction();
      return updatedEvent;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to generate attendance PDF: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }
  //  ASSIGN PARTICIPANTS TO EVENT
  async assignParticipantsToEvent(
    eventId: string,
    participantIds: string[],
    queryRunner?: QueryRunner, // optional
  ) {
    const runner = queryRunner || this.dataSource.createQueryRunner();
    let ownTransaction = false;

    if (!queryRunner) {
      await runner.connect();
      await runner.startTransaction();
      ownTransaction = true;
    }

    try {
      const eventRepo = runner.manager.getRepository(Event);
      const participantRepo = runner.manager.getRepository(Participant);

      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['participants'],
      });
      if (!event) throw new NotFoundException('Event not found');

      const participants = await participantRepo.findBy({ id: In(participantIds) });

      event.participants = [...(event.participants || []), ...participants];
      const updatedEvent = await eventRepo.save(event);

      if (ownTransaction) await runner.commitTransaction();
      await this.updateEventStatusIfReady(eventId);
      return updatedEvent;
    } catch (err) {
      if (ownTransaction) await runner.rollbackTransaction();
      throw err;
    } finally {
      if (ownTransaction) await runner.release();
    }
  }

  async alterStatus(id: UUID, status: event_status) {
    try {
      const event = await this.eventDAL.findOne({
        where: {
          id: id
        }
      })
      if (!event) {
        throw new NotFoundException("couldn't alter the event status: event not found")
      }
      event.event_status = status as event_status
      await this.eventRepo.save(event)

      return {
        success: true,
        message: `Event status updated successfully. Event ${event.id} is now '${event.event_status}'.`,
        event,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      }
      throw new InternalServerErrorException(
        `Failed to alter event status: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // REMOVE PARTICIPANTS FROM EVENT
  async removeParticipantFromEvent(eventId: string, participantId: string) {
    return this.dataSource.transaction(async (manager) => {
      const eventRepo = manager.getRepository(Event);
      const participantRepo = manager.getRepository(Participant);

      // 1. Load event
      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['participants'],
      });
      if (!event) throw new NotFoundException('Event not found');

      // 2. Ensure participant exists
      const participant = await participantRepo.findOne({
        where: { id: participantId },
      });
      if (!participant) throw new NotFoundException('Participant not found');

      // 3. Remove relation
      event.participants = event.participants.filter(
        p => p.id !== participantId,
      );
      await eventRepo.save(event);

      // 4. Count remaining event relations FROM DB
      const remainingEventsCount = await eventRepo
        .createQueryBuilder('e')
        .innerJoin('e.participants', 'p')
        .where('p.id = :participantId', { participantId })
        .getCount();

      // 5. Hard delete orphan participant
      if (remainingEventsCount === 0) {
        await participantRepo.delete(participantId);
      }

      return {
        message:
          remainingEventsCount === 0
            ? 'Participant permanently deleted'
            : 'Participant removed from event ',
      };
    });
  }


  //  UPDATE (REPLACE ALL PARTICIPANTS)
  async updateParticipantsForEvent(eventId: string, participantIds: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const eventRepo = queryRunner.manager.getRepository(Event);
      const participantRepo = queryRunner.manager.getRepository(Participant);

      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['participants'],
      });
      if (!event) throw new NotFoundException('Event not found');

      const participants = await participantRepo.findBy({ id: In(participantIds) });
      event.participants = participants;
      const updatedEvent = await eventRepo.save(event);

      await queryRunner.commitTransaction();
      return updatedEvent;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) {
        throw error
      }
      console.error('Failed to update participants:', error);

      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the participants. Please try again later.',
      );

    } finally {
      await queryRunner.release();
    }
  }

  // GET ALL PARTICIPANTS ASSIGNED TO EVENT
  async getEventParticipants(
    eventId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Participant[]; total: number; page: number; limit: number }> {
    const eventRepo = this.dataSource.getRepository(Event);

    // Check if the event exists
    const event = await eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const participantRepo = this.dataSource.getRepository(Participant);

    const [data, total] = await participantRepo
      .createQueryBuilder('participant')
      .innerJoin('participant.events', 'event', 'event.id = :eventId', { eventId })
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async updateEventStatusIfReady(eventId: string) {
    try {
      const eventRepo = this.dataSource.getRepository(Event);

      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['participants'],
      });

      if (!event) return;

      const hasParticipants = event.participants?.length > 0;

      if (hasParticipants && event.event_status !== event_status.ONGOING) {
        event.event_status = event_status.ONGOING;
        await eventRepo.save(event);
        console.log(`Event ${event.id} marked as ONGOING`);
      }
      else if (!hasParticipants && event.event_status === event_status.ONGOING) {
        event.event_status = event_status.INITATED;
        await eventRepo.save(event);
        console.log(`Event ${event.id} reverted back to INITIATED`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      }
      console.error('Failed to update event status:', error);

      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the event status. Please try again later.',
      );

    }
  }

  async findOne(id: string) {
    const res = await this.eventDAL.findOne({
      where: { id: id },
      relations: ['trainers', 'documents', 'participants', 'event_dates', 'event_dates.event_sessions', 'event_dates.event_sessions.session_participant_maps', 'event_dates.event_sessions.session_participant_maps.participant']
    })
    return res;
  }

  async eventDocsPath(id: string, doc_type?: doc_type) {

    const event = await this.eventDAL.findOne({
      where: { id },
      relations: ['documents'],
    });

    if (!event) throw new Error('Event not found');

    const filteredDocs = doc_type
      ? event.documents.filter(doc => doc.doc_type === doc_type)
      : event.documents;

    const documents = await Promise.all(
      filteredDocs.map(async doc => ({
        id: doc.id,
        path: doc.path,
        url: await this.documentService.viewDoc(doc.path),
      }))
    );
    return {
      success: true,
      message: 'Document URLs generated successfully',
      data: documents
    };
  }

  async remove(id: string, deleted_by: string) {
    try {
      const event = await this.findOne(id)
      if (!event) {
        throw new NotFoundException("event to be deleted not found...")
      }
      if (event.event_status != event_status.INITATED) {
        throw new BadRequestException('only event with status initiated can be deleted...')
      }
      const result = await this.eventDAL.softDelete(id, { deleted_by });
      return {
        success: true,
        message: 'Event removed successfully',
        id,
        result,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to remove: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getImageBase64(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const ext = url.split('.').pop();
    return `data:image/${ext};base64,${base64}`;
  }

  async getProjectName(token: string, projectId: UUID) {
    const baseUrl = process.env.DYNAMIC_FORM_BASE_URL || 'http://http://13.50.253.205:4499/api/v1/dynamic-form';
    const url = `${baseUrl}/project/${projectId}`;
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const resp = await axios.get(url, { headers });
      const names = resp.data.data.name;
      const projectName =
        names.find(item => item.locale === 'EN')?.key ||
        names.find(item => item.locale === 'AM')?.key ||
        names[0]?.key;

      // Capitalize each word in the project name
      const capitalizeWords = (s: string) =>
        s
          .trim()
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

      return capitalizeWords(String(projectName));
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to get project name: ${msg}`);
    }
  }

  async generateAttendancePdf(eventId: string, token: string, report: boolean): Promise<Buffer> {
    const logMessage = report ? 'generating atteandance report ...' : 'generating attendance ...';
    console.log(logMessage);
    try {
      const event = await this.eventDAL.findOne({
        where: { id: eventId },
        relations: [
          'participants',
          'participants.session_participant_maps',
          'participants.session_participant_maps.event_session',
          'participants.session_participant_maps.participant',
          'event_dates.event_sessions.session_participant_maps.participant',
          'event_dates',
          'event_dates.event_sessions',
          'event_dates.event_sessions.session_participant_maps',
          'event_dates.event_sessions.session_participant_maps.event_session',
        ],
      });

      if (!event) throw new Error('Event not found');
      if (event.event_status == event_status.INITATED && report) {
        throw new BadRequestException(
          `Attendance report can not be generated for a initiated event.`
        )
      }

      const projectName = await this.getProjectName(token, event.project_id as UUID);

      if (Array.isArray(event.participants)) {
        event.participants = CapitalizeInterceptor.capitalizeData(event.participants);
        const priority: Record<string, number> = {
          [participant_type.LERSHA_AGENT]: 1,
          [participant_type.FARMER]: 2,
          [participant_type.EXTENSION_WORKERS]: 3,
          [participant_type.GOVERNMENT_OFFICIALS]: 4,
        };

        event.participants = event.participants.sort((a, b) => {
          const typeA = a.participant_type;
          const typeB = b.participant_type;

          const pA = (typeA && priority[typeA]) ? priority[typeA] : 3;
          const pB = (typeB && priority[typeB]) ? priority[typeB] : 3;

          if (pA !== pB) {
            return pA - pB;
          }

          return (a.first_name || '').localeCompare(b.first_name || '', undefined, { sensitivity: 'base' });
        });
      } else {
        event.participants = [];
      }

      if (typeof event.name === 'string') {
        event.name = event.name.split(' ').map(word => capitalizeFirstLetter(word)).join(' ');
      } else {
        event.name = '';
      }

      const logoBase64 = await this.getImageBase64(
        'https://lersha.com/wp-content/uploads/2023/09/lerlogo-1024x313.png'
      );

      const fonts = {
        Roboto: {
          normal: path.join(__dirname, '..', 'fonts', 'Roboto-Regular.ttf'),
          bold: path.join(__dirname, '..', 'fonts', 'Roboto-Medium.ttf'),
          italics: path.join(__dirname, '..', 'fonts', 'Roboto-Italic.ttf'),
          bolditalics: path.join(__dirname, '..', 'fonts', 'Roboto-MediumItalic.ttf'),
        },
      };

      const printer = new PdfPrinter(fonts);

      const participantsPerPage = 20;
      const datesPerPage = !!event.is_day_based ? 6 : 3;

      const participants = event.participants || [];
      const eventDates = (event.event_dates || []).map(d => {
        if (!d) return '';
        if (d.date instanceof Date) return d.date.toLocaleDateString();
        return String(d.date);
      });

      let content: any[] = [];

      function chunkDates<T>(list: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < list.length; i += size) {
          out.push(list.slice(i, i + size));
        }
        return out;
      }

      const dateGroups = chunkDates(eventDates, datesPerPage);
      const isDayBased = !!event.is_day_based;

      for (let dgIndex = 0; dgIndex < dateGroups.length; dgIndex++) {
        const dateSet = dateGroups[dgIndex];

        let rowNumber = 1;

        content.push(
          {
            columns: [{ image: logoBase64, width: 100 }],
            columnGap: 10,
            margin: [0, 0, 0, 10],
          },
          {
            text: 'Green Agro-Solution PLC (Lersha)',
            style: { fontSize: 20, bold: true },
            margin: [0, 0, 0, 10],
            alignment: 'center',
          },
          {
            text: `Project Name: ${projectName} `,
            style: { fontSize: 17 },
            margin: [0, 0, 0, 10],
            alignment: 'center',
          }
        );

        let headerRow1: any[];
        let headerRow2: any[] | undefined;
        let tableHeader: any[][];
        let headerRowsCount: number;

        if (isDayBased) {
          headerRow1 = [
            { text: '#', bold: true, alignment: 'center' },
            { text: 'Full Name', bold: true, alignment: 'center' },
            { text: 'Gender', bold: true, alignment: 'center' },
            { text: 'Role', bold: true, alignment: 'center' },
            { text: 'Phone No', bold: true, alignment: 'center' },
            { text: 'Signature', alignment: 'center', bold: true, colSpan: dateSet.length },
          ];
          for (let i = 1; i < dateSet.length; i++) headerRow1.push({});

          headerRow2 = [
            {},
            {},
            {},
            {},
            {},
            ...dateSet.map(date => ({ text: date, alignment: 'center', bold: true }))
          ];

          tableHeader = [headerRow1, headerRow2];
          headerRowsCount = 2;

        } else {
          const totalSpan = dateSet.length * 2;
          headerRow1 = [
            { text: '#', rowSpan: 3, bold: true, alignment: 'center' },
            { text: 'Full Name', rowSpan: 3, bold: true, alignment: 'center' },
            { text: 'Gender', rowSpan: 3, bold: true, alignment: 'center' },
            { text: 'Participant_type', rowSpan: 3, bold: true, alignment: 'center' },
            { text: 'Phone No', rowSpan: 3, bold: true, alignment: 'center' },
            { text: 'Signature', alignment: 'center', bold: true, colSpan: totalSpan },
          ];
          for (let i = 1; i < totalSpan; i++) headerRow1.push({});

          headerRow2 = [
            {},
            {},
            {},
            {},
            {},
            ...dateSet.flatMap(date => [{ text: date, alignment: 'center', bold: true, colSpan: 2 }, {}])
          ];

          const headerRow3 = [
            {},
            {},
            {},
            {},
            {},
            ...dateSet.flatMap(() => [
              { text: 'Morning', alignment: 'center' },
              { text: 'Afternoon', alignment: 'center' }
            ])
          ];

          tableHeader = [headerRow1, headerRow2, headerRow3];
          headerRowsCount = 3;
        }

        for (let i = 0; i < participants.length; i += participantsPerPage) {
          const pageParticipants = participants.slice(i, i + participantsPerPage);
          const tableBody: any[] = [...tableHeader];

          function normalizeStatus(status: any): 'present' | 'absent' | null {
            if (status === attendance.PRESENT) return 'present';
            if (status === attendance.ABSENT) return 'absent';
            return null;
          }

          function displayCell(val: 'present' | 'absent' | null, report: boolean) {
            if (report && val === null) return { text: 'N/B' };
            if (report && val === 'present') return { text: 'P' };
            if (report && val === 'absent') return { text: 'A' };
            return { text: '' };
          }

          for (let j = 0; j < pageParticipants.length; j++) {
            const p = pageParticipants[j];

            const attendanceColumns = dateSet.flatMap(date => {
              const eventDate = event.event_dates.find(
                ed => new Date(ed.date).toLocaleDateString() === new Date(date).toLocaleDateString()
              );

              if (!eventDate)
                return isDayBased ? [displayCell(null, report)] : [displayCell(null, report), displayCell(null, report)];

              if (isDayBased) {
                const session = (eventDate.event_sessions || [])[0];
                const map = session?.session_participant_maps?.find(m => m.participant?.id === p.id);
                const status = normalizeStatus(map?.attendance?.status ?? null);
                return [displayCell(status, report)];
              } else {
                const morningSession = (eventDate.event_sessions || []).find(s => s.session_type == "morning");
                const afternoonSession = (eventDate.event_sessions || []).find(s => s.session_type == "afternoon");

                const morningMap = morningSession?.session_participant_maps?.find(m => String(m.participant?.id).toLowerCase() === String(p.id).toLowerCase());
                const afternoonMap = afternoonSession?.session_participant_maps?.find(m => String(m.participant?.id).toLowerCase() === String(p.id).toLowerCase());

                const morningStatus = normalizeStatus(morningMap?.attendance?.status ?? null);
                const afternoonStatus = normalizeStatus(afternoonMap?.attendance?.status ?? null);

                return [displayCell(morningStatus, report), displayCell(afternoonStatus, report)];
              }
            });

            const row = [
              { text: String(rowNumber++) },
              { text: `${p.first_name ?? ''} ${p.father_name ?? ''}`.trim() || '-' },
              { text: p.gender ?? '-' },
              { text: p.participant_type ?? '-', alignment: 'center' },
              { text: p.phone ?? '-' },
              ...attendanceColumns
            ];

            tableBody.push(row);
          }

          const remainingRows = participantsPerPage - pageParticipants.length;
          for (let k = 0; k < remainingRows; k++) {
            tableBody.push([
              String(rowNumber++),
              '',
              '',
              '',
              '',
              ...dateSet.flatMap(() => isDayBased ? [''] : ['', ''])
            ]);
          }

          // additional blank block (keeps space for signatures)
          for (let extra = 0; extra < participantsPerPage; extra++) {
            tableBody.push([
              String(rowNumber++),
              '',
              '',
              '',
              '',
              ...dateSet.flatMap(() => isDayBased ? [''] : ['', ''])
            ]);
          }
          const reportTypeIndicator: reportType = report ? reportType.ATT_REP : reportType.EMPTY_ATT;
          content.push(
            {
              text: `${event.name} Attendance Sheet ${reportTypeIndicator}`,
              style: 'header',
              margin: [0, 5, 0, 15],
            },
            {
              table: {
                headerRows: headerRowsCount,
                widths: [
                  25,
                  '*',
                  60,
                  95,
                  95,
                  ...dateSet.flatMap(() => isDayBased ? [58] : [58, 58])
                ],
                body: tableBody
              },
              layout: {
                fillColor: (rowIndex: number) => (rowIndex < headerRowsCount ? '#F5F5F5' : null),
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5
              }
            }
          );

          const isLastDateGroup = dgIndex === dateGroups.length - 1;
          const isLastParticipantPage = i + participantsPerPage >= participants.length;
          if (!(isLastDateGroup && isLastParticipantPage)) {
            content.push({ text: '', pageBreak: 'after' });
          }
        }
      }
      
      // Per Diem Sheet Generation
      for (let i = 0; i < participants.length; i += participantsPerPage) {
        const pageParticipants = participants.slice(i, i + participantsPerPage);

        let rowNumber = i + 1;

        const tableBody: any[] = [
          [
            { text: '#', bold: true, alignment: 'center' },
            { text: 'Full Name', bold: true, alignment: 'center' },
            { text: 'Role', bold: true, alignment: 'center' },
            { text: 'Phone No', bold: true, alignment: 'center' },
            { text: 'Bank Name', bold: true, alignment: 'center' },
            { text: 'Bank Account', bold: true, alignment: 'center' },
            { text: 'Branch', bold: true, alignment: 'center' },
            { text: 'Signature', bold: true, alignment: 'center' },
          ]
        ];

        for (const p of pageParticipants) {
          tableBody.push([
            { text: String(rowNumber++) },
            { text: `${p.first_name ?? ''} ${p.father_name ?? ''}`.trim() || '-' },
            { text: p.participant_type ?? '-', alignment: 'center' },
            { text: p.phone ?? '-' },
            { text: '' },
            { text: '' },
            { text: '' },
            { text: '' }
          ]);
        }

        const remainingRows = participantsPerPage - pageParticipants.length;
        for (let k = 0; k < remainingRows; k++) {
          tableBody.push([
            String(rowNumber++),
            '',
            '',
            '',
            '',
            '',
            '',
            ''
          ]);
        }

        // additional blank block (keeps space for signatures)
        for (let extra = 0; extra < participantsPerPage; extra++) {
          tableBody.push([
            String(rowNumber++),
            '',
            '',
            '',
            '',
            '',
            '',
            ''
          ]);
        }

        content.push(
          {
            text: 'Per Diem Sheet',
            style: 'header',
            margin: [0, 5, 0, 15],
            pageBreak: 'before'
          },
          {
            table: {
              headerRows: 1,
              widths: [25, '*', 80, 80, 100, 100, 100, 80],
              body: tableBody
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex < 1 ? '#F5F5F5' : null),
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5
            }
          }
        );
      }

      const docDefinition: any = {
        pageOrientation: 'landscape',
        pageSize: 'A4',
        content,
        styles: {
          header: { fontSize: 18, bold: true, alignment: 'center' },
          subheader: { fontSize: 14, bold: true }
        },
        defaultStyle: { font: 'Roboto', fontSize: 11 }
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Uint8Array[] = [];

      await this.participantSessionMap(eventId);
      console.log("generated.");

      return new Promise<Buffer>((resolve, reject) => {
        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);
        pdfDoc.end();
      });

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to generate attendance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }


  async sessionBasedManualAttFill(eventId: UUID, sessionParticipanrMaps: UpdateSessionParticipantStatusDto[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verify the event exists
      const event = await this.eventDAL.findOne({
        where: { id: eventId },
        relations: ['event_dates', 'event_dates.event_sessions', 'event_dates.event_sessions.session_participant_maps']
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }

      // Assuming sessionParticipanrMaps contains { sessionParticipantMapId, status }
      for (const item of sessionParticipanrMaps) {
        const map = await queryRunner.manager.findOne(SessionParticipantMap, {
          where: { id: item.sessionParticipantMapId },
          relations: ['event_session', 'event_session.event_date']
        });

        if (!map) {
          throw new NotFoundException(`Session participant map with ID ${item.sessionParticipantMapId} not found`);
        }

        // Check if the map belongs to the event
        const belongsToEvent = event.event_dates.some(eventDate =>
          eventDate.event_sessions.some(sess =>
            sess.id === map.event_session.id
          )
        );

        if (!belongsToEvent) {
          throw new BadRequestException(`Session participant map ${item.sessionParticipantMapId} does not belong to event ${eventId}`);
        }
        // Update attendance
        const normalizedStatus = typeof item.status === 'string' ? item.status.trim().toLowerCase() : item.status;
        map.attendance = { ...map.attendance, status: normalizedStatus };
        await queryRunner.manager.save(map);
      }
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Attendance updated successfully',
        updated_count: sessionParticipanrMaps.length
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to update the event: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async dayBasedManualAttFill(eventId: UUID, dateParticipantMaps: UpdateDateParticipantStatusDto[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Ensure session participant maps exist
      await this.participantSessionMap(eventId);

      // Verify the event exists with relations
      const event = await queryRunner.manager.findOne(Event, {
        where: { id: eventId },
        relations: ['event_dates', 'event_dates.event_sessions']
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }

      const eventDateIds = event.event_dates.map(ed => ed.id);

      let updatedCount = 0;

      for (const item of dateParticipantMaps) {
        // Check if the eventDateId belongs to the event
        if (!eventDateIds.includes(item.eventDateId)) {
          throw new BadRequestException(`Event date ${item.eventDateId} does not belong to event ${eventId}`);
        }

        // Find the event date and its sessions
        const eventDate = event.event_dates.find(ed => ed.id === item.eventDateId);
        const sessions = eventDate?.event_sessions || [];

        // For each session (should be 2), update the participant's attendance
        for (const session of sessions) {
          const map = await queryRunner.manager.findOne(SessionParticipantMap, {
            where: {
              participant: { id: item.participantId },
              event_session: { id: session.id }
            }
          });
          const normalizedStatus = typeof item.status === 'string' ? item.status.trim().toLowerCase() : item.status;

          if (map) {

            map.attendance = { ...map.attendance, status: normalizedStatus };
            await queryRunner.manager.save(map);
            updatedCount++;
          }
          // Note: Not throwing error if map not found, assuming participantSessionMap ensures they exist
        }
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Day-based attendance updated successfully',
        updated_count: updatedCount
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      throw new InternalServerErrorException(
        `Failed to update the event: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await queryRunner.release();
    }
  }
  async getAttendanceReport(eventId: string, report: boolean) {
    try {
      // Ensure session participant maps exist
      await this.participantSessionMap(eventId);

      const event = await this.eventDAL.findOne({
        where: { id: eventId },
        relations: [
          'participants',
          'event_dates',
          'event_dates.event_sessions',
          'event_dates.event_sessions.session_participant_maps',
          'event_dates.event_sessions.session_participant_maps.participant',
        ],
      });

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }

      const isDayBased = !!event.is_day_based;
      const headers: any[] = [];
      const data: any[] = [];

      // Sort dates
      const sortedDates = (event.event_dates || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (isDayBased) {
        // Headers: Date
        sortedDates.forEach(ed => {
          headers.push({
            label: new Date(ed.date).toDateString(),
            date: ed.date,
            id: ed.id,
            type: 'day'
          });
        });

        // Data
        for (const p of (event.participants || [])) {
          const history: any = {};
          for (const ed of sortedDates) {
            // For day based, check the first session (assuming sync) or any session for that date
            const session = ed.event_sessions?.[0];
            let status = null;
            if (session) {
              const map = session.session_participant_maps?.find(m => m.participant?.id === p.id);
              if (map?.attendance?.status) status = map.attendance.status;
            }
            // Return object with status and eventDateId
            history[new Date(ed.date).toDateString()] = {
              status,
              eventDateId: ed.id
            };
          }
          data.push({
            participant: {
              id: p.id,
              first_name: p.first_name,
              father_name: p.father_name,
              gender: p.gender,
              phone: p.phone
            },
            history
          })
        }

      } else {
        // Session based
        // Headers: Date - SessionType
        sortedDates.forEach(ed => {
          const sessions = (ed.event_sessions || []).sort((a, b) => {
            if (a.session_type === session_type.MORNING) return -1;
            if (b.session_type === session_type.MORNING) return 1;
            return 0;
          });

          sessions.forEach(sess => {
            headers.push({
              label: `${new Date(ed.date).toDateString()} - ${sess.session_type}`,
              date: ed.date,
              session_type: sess.session_type,
              sessionId: sess.id,
              type: 'session'
            });
          })
        });

        for (const p of (event.participants || [])) {
          const history: any = {};
          for (const ed of sortedDates) {
            const sessions = (ed.event_sessions || []).sort((a, b) => {
              if (a.session_type === session_type.MORNING) return -1;
              if (b.session_type === session_type.MORNING) return 1;
              return 0;
            });

            for (const sess of sessions) {
              const map = sess.session_participant_maps?.find(m => m.participant?.id === p.id);
              const key = `${new Date(ed.date).toDateString()} - ${sess.session_type}`;
              // Return object with status and sessionParticipantMapId
              history[key] = {
                status: map?.attendance?.status || null,
                sessionParticipantMapId: map?.id || null
              };
            }
          }
          data.push({
            participant: {
              id: p.id,
              first_name: p.first_name,
              father_name: p.father_name,
              gender: p.gender,
              phone: p.phone
            },
            history
          })
        }
      }

      return {
        event: {
          id: event.id,
          name: event.name,
          is_day_based: isDayBased
        },
        headers,
        data
      }

    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) throw error;

      console.error('Failed to get attendance report:', error);

      throw new InternalServerErrorException(
        'An unexpected error occurred while retrieving the attendance report. Please try again later.',
      );

    }
  }
}
