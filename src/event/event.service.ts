import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, In, Repository } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { DocumentService } from 'src/document/document.service';
import { attendance, doc_type, event_status, gender, participant_type, reportType, session_type } from 'src/common/constants/enums';
import { Trainer } from './trainer/entities/trainer.entity';
import { Event } from './entities/event.entity';
import { Participant } from './participant/entities/participant.entity';
import { EmailService } from 'src/common/notification/email.service';
import { LocationService } from 'src/location/location.service';
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
    private readonly locationService: LocationService,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateEventDto, file: Express.Multer.File, created_by: string, token?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const bucketName = process.env.AWS_S3_BUCKET_NAME!;
      const folder = 'tor';

      // Resolve location_id from region, zone, and woreda if provided
      let location_id = dto.location_id;
      if (dto.region && dto.zone && dto.woreda && token) {
        const locationData = await this.locationService.getLocationCode(
          dto.region,
          dto.zone,
          dto.woreda,
          token,
        );
        if (locationData) {
          location_id = locationData.id;
        } else {
          throw new BadRequestException(
            `Location not found for region: ${dto.region}, zone: ${dto.zone}, woreda: ${dto.woreda}`
          );
        }
      }

      if (!location_id) {
        throw new BadRequestException(
          'Either location_id or (region, zone, and woreda) must be provided'
        );
      }

      const event = await this.eventDAL.create({
        project_id: dto.project_id,
        type: dto.type,
        name: dto.name,
        location_id: location_id,
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

      const enrichedEvent = await this.findOne(event.id, token);

      if (dto.trainers?.length) {
        const trainers = dto.trainers
        await this.assignTrainersToEvent(event.id, trainers)
      }

      return {
        success: true,
        message: 'Event created successfully',
        data: {
          event: enrichedEvent,
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

  async replaceTOR(id: UUID, file: Express.Multer.File, updated_by: string, token?: string, queryRunner?: QueryRunner) {
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

      const event = await this.findOne(String(id), token);
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

  async update(id: string, updateEventDto: UpdateEventDto, updated_by: string, token?: string, file?: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const event = await this.findOne(id)
      if (!event) {
        throw new NotFoundException('event to be updated not found...')
      }

      const { trainers, event_dates, region, zone, woreda, location_id: dto_location_id, ...eventData } = updateEventDto;

      let location_id = dto_location_id;
      if (region && zone && woreda && token) {
        const locationData = await this.locationService.getLocationCode(
          region,
          zone,
          woreda,
          token,
        );
        if (locationData) {
          location_id = locationData.id;
        } else {
          throw new BadRequestException(
            `Location not found for region: ${region}, zone: ${zone}, woreda: ${woreda}`
          );
        }
      }

      // Update scalar properties - map DTO fields to entity properties
      if (Object.keys(eventData).length > 0 || location_id) {
        const updateData: any = { ...eventData };
        if (location_id) {
          updateData.location_id = location_id;
        }
        if (updateData.status !== undefined) {
          updateData.event_status = updateData.status;
          delete updateData.status;
        }

        await this.eventDAL.update(id, { ...updateData, updated_by }, queryRunner);
      }

      // Update event_dates relation
      let datesChanged = true;
      if (event_dates && event.event_dates) {
        const existing = event.event_dates.map(d => new Date(d.date).toDateString()).sort();
        const incoming = event_dates.map(d => new Date(d).toDateString()).sort();
        if (JSON.stringify(existing) === JSON.stringify(incoming)) {
          datesChanged = false;
        }
      }

      if (event_dates && datesChanged) {
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
        await this.replaceTOR(id as UUID, file, updated_by, token, queryRunner)
      }

      // Update trainers if provided
      if (trainers && trainers.length > 0) {
        await this.updateTrainersForEvent(event.id, trainers);
      }

      await queryRunner.commitTransaction();

      // Return the updated event with relations
      const updatedEvent = await this.findOne(id, token);
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
  }, token?: string) {
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

    const result = await this.eventDAL.findAll(options);
    console.log(`findAll: token present? ${!!token}, data count: ${result.data.length}`);

    if (token && result.data.length > 0) {
      try {
        const locationsMap = await this.locationService.getLocationsMap(token);
        result.data = result.data.map(event => {
          if (event.location_id) {
            const normalizedId = String(event.location_id);
            if (locationsMap.has(normalizedId)) {
              const loc = locationsMap.get(normalizedId);
              event.region = loc.region;
              event.zone = loc.zone;
              event.woreda = loc.woreda;
            } else {
              console.warn(`Location ID ${event.location_id} not found in locations map for event ${event.id}`);
            }
          }
          return event;
        });
      } catch (error) {
        console.error('Failed to fetch location names for findAll:', error.message);
      }
    }

    return result;
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
            }
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
      const trainers = await trainerRepo.findBy({ id: In(trainerIds) });

      const foundIds = new Set(trainers.map((t) => t.id));
      const missing = trainerIds.filter((id) => !foundIds.has(id));
      if (missing.length) {
        throw new NotFoundException(`Trainers not found: ${missing.join(', ')}`);
      }
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

    participants: any[] | undefined, // Mix of IDs or Participant Objects
    queryRunner?: QueryRunner, // optional
    token?: string,
  ) {
    if (!participants || !Array.isArray(participants)) {
      throw new BadRequestException('Participants must be provided as an array');
    }
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

      const finalParticipantIds: string[] = [];

      for (const p of participants) {
        if (typeof p === 'string') {
          // It's a local ID
          finalParticipantIds.push(p);
        } else if (p && typeof p === 'object') {
          let existing = await participantRepo.findOne({
            where: [
              { phone: p.phone },
              { external_participant_id: String(p.external_participant_id || p.id) }
            ],
            withDeleted: true,
          });

          if (existing) {
            if (existing.deleted_at) {
              await runner.manager.restore(Participant, existing.id);
            }
            finalParticipantIds.push(existing.id);
          } else {

            // Normalize for entity
            const newParticipant = participantRepo.create({
              ...p,
              external_participant_id: String(p.external_participant_id || p.id),
              id: undefined, // let typeorm generate UUID
              age: String(p.age || '0'),
            });

            // Save may return either a single entity or an array; normalize to a single Participant.
            const savedResult = await runner.manager.save(newParticipant) as unknown;
            const savedEntity = Array.isArray(savedResult) ? (savedResult as Participant[])[0] : (savedResult as Participant);
            finalParticipantIds.push(savedEntity.id);
          }
        }
      }

      const dbParticipants = await participantRepo.findBy({ id: In(finalParticipantIds) });

      // Avoid duplicates
      const existingIds = new Set(event.participants?.map(p => p.id) || []);
      const toAdd = dbParticipants.filter(p => !existingIds.has(p.id));

      event.participants = [...(event.participants || []), ...toAdd];
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

  async searchParticipantsForEvent(
    eventId: string,
    search: string,
    page = 1,
    limit = 10,
    token?: string,
    filters?: {
      participant_type?: participant_type;
      region?: string;
      zone?: string;
      kebele?: string;
    },
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      const participantRepo = this.dataSource.getRepository(Participant);

      // 1. Get already assigned participant info to exclude
      const assignedResult = await this.getEventParticipants(eventId, 1, 10000);
      const assignedExternalIds = new Set<string>();
      const assignedPhones = new Set<string>();

      assignedResult.data.forEach(p => {
        if (p.external_participant_id) assignedExternalIds.add(p.external_participant_id);
        if (p.phone) assignedPhones.add(p.phone);
      });

      // 2. Fetch Local Participants (excluding assigned)
      const queryBuilder = participantRepo.createQueryBuilder('p').withDeleted();
      if (search && search.trim() !== '') {
        queryBuilder.andWhere(
          '(p.first_name ILIKE :search OR p.father_name ILIKE :search OR p.phone ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      if (filters?.participant_type) {
        queryBuilder.andWhere('p.participant_type = :pType', { pType: filters.participant_type });
      }
      if (filters?.region) {
        queryBuilder.andWhere('p.region ILIKE :region', { region: `%${filters.region}%` });
      }
      if (filters?.zone) {
        queryBuilder.andWhere('p.zone ILIKE :zone', { zone: `%${filters.zone}%` });
      }
      if (filters?.kebele) {
        queryBuilder.andWhere('p.kebele ILIKE :kebele', { kebele: `%${filters.kebele}%` });
      }

      // We sub-filter assigned by phone/id to be safe
      const allLocalHits = await queryBuilder.getMany();
      let localData = allLocalHits
        .filter(p => !assignedPhones.has(p.phone))
        .map(p => ({ ...p, source: 'local' }));

      // Fetch External Sources
      let externalData: any[] = [];
      const hasSearch = search && search.trim() !== '';
      const hasLocationFilters = filters && (filters.region || filters.zone || filters.kebele);
      const shouldFetchExternal = token && (hasSearch || hasLocationFilters || filters?.participant_type);

      if (shouldFetchExternal) {
        const headers = { Authorization: `Bearer ${token}` };

        // Optimization: Only fetch Agents if type is unspecified or specified as LERSHA_AGENT
        if (!filters?.participant_type || filters.participant_type === participant_type.LERSHA_AGENT) {
          try {
            // A. Agents
            const agentBaseUrl = process.env.AGENT_SERVICE_URL || 'http://13.50.253.205:3344/api/v1/dynamic-form/project/all_agents';
            let agentUrl = `${agentBaseUrl}?search=${search || ''}`;
            if (filters?.region) agentUrl += `&region=${filters.region}`;
            if (filters?.zone) agentUrl += `&zone=${filters.zone}`;
            if (filters?.kebele) agentUrl += `&kebele=${filters.kebele}`;

            const agentsRes = await axios.get(agentUrl, { headers });
            if (agentsRes.data?.data) {
              const agents = Array.isArray(agentsRes.data.data) ? agentsRes.data.data : [agentsRes.data.data];
              externalData.push(
                ...agents.map(a => ({
                  id: a.id,
                  external_participant_id: String(a.id),

                  first_name: (a.first_name),
                  father_name: (a.middle_name),
                  Grandfather_name: (a.last_name || ''),
                  age: (a.age || ""),
                  phone: a.phone_number || a.user?.phone_number,
                  gender:
                    a.gender?.toLowerCase() === 'male'
                      ? gender.MALE
                      : gender.FEMALE,

                  region: a.location?.region || null,
                  zone: a.location?.zone || null,
                  woreda: a.location?.woreda || null,
                  kebele: a.kebele || null,

                  source: 'Agent',
                  participant_type: participant_type.LERSHA_AGENT,
                })),
              );
            }
          } catch (e) {
            console.error('Failed to fetch agents:', e.message);
          }
        }

        // Optimization: Only fetch Farmers if type is unspecified or specified as FARMER
        if (!filters?.participant_type || filters.participant_type === participant_type.FARMER) {
          try {
            // B. Farmers
            const payload = {
              search: search || "",
              region: filters?.region,
              zone: filters?.zone,
              woreda: filters?.kebele
            };
            const farmerUrl = process.env.FARMER_SERVICE_URL || `http://13.50.253.205:3344/api/v1/farmer/find_all`;
            const farmersRes = await axios.post(farmerUrl, payload, { headers });
            if (farmersRes.data?.data?.data) {
              const farmers = Array.isArray(farmersRes.data.data.data) ? farmersRes.data.data.data : [];
              externalData.push(...farmers.map(f => ({
                id: f.id,
                external_participant_id: String(f.id),
                first_name: f.first_name,
                father_name: f.middle_name || f.father_name || '',
                Grandfather_name: f.last_name || f.Grandfather_name || '',
                age: (f.age || ""),
                phone: f.phone || f.phone_number,
                gender: f.gender?.toLowerCase() === 'male' ? gender.MALE : gender.FEMALE,
                region: f.location?.region || f.region,
                zone: f.location?.zone || f.zone,
                woreda: f.location?.woreda || f.woreda,
                kebele: f.address?.kebele || f.kebele,
                source: 'farmer',
                participant_type: participant_type.FARMER
              })));
            }
          } catch (e) {
            console.error('Failed to fetch farmers:', e.message);
          }
        }
      }

      // Final filter for external data (exclude assigned and local hits, and ensure search match)
      const externalPhones = externalData.map(p => p.phone).filter(Boolean);
      const externalIds = externalData.map(p => p.external_participant_id).filter(Boolean);

      // Fetch ALL local participants with matching phones/IDs to ensure no collisions
      const localCollisions = await participantRepo.find({
        where: [
          { phone: In(externalPhones) },
          { external_participant_id: In(externalIds) }
        ].filter(c => (c as any).phone?.length > 0 || (c as any).external_participant_id?.length > 0),
        withDeleted: true
      });

      const localPhoneSet = new Set(localCollisions.map(p => p.phone));
      const localIdSet = new Set(localCollisions.map(p => p.external_participant_id));
      const searchLower = search ? search.toLowerCase() : '';

      externalData = externalData.filter(p => {
        // Exclude assigned
        if (assignedExternalIds.has(String(p.id)) || assignedPhones.has(p.phone)) return false;

        // Exclude local duplicates (including those that didn't match the search term)
        if (localPhoneSet.has(p.phone) || localIdSet.has(p.external_participant_id)) return false;

        // Apply filters
        if (filters?.region && !p.region?.toLowerCase().includes(filters.region.toLowerCase())) return false;
        if (filters?.zone && !p.zone?.toLowerCase().includes(filters.zone.toLowerCase())) return false;
        if (filters?.kebele && !p.kebele?.toLowerCase().includes(filters.kebele.toLowerCase())) return false;

        // Apply Search match check
        const matchesSearch =
          (p.first_name && p.first_name.toLowerCase().includes(searchLower)) ||
          (p.father_name && p.father_name.toLowerCase().includes(searchLower)) ||
          (p.Grandfather_name && p.Grandfather_name.toLowerCase().includes(searchLower)) ||
          (p.phone && p.phone.toLowerCase().includes(searchLower));

        return matchesSearch;
      });

      const mergedData = [...localData, ...externalData];

      return {
        data: mergedData.slice((page - 1) * limit, page * limit),
        total: mergedData.length,
        page,
        limit,
      };
    } catch (error) {
      console.error('EventService.searchParticipantsForEvent failed:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while searching participants.',
      );
    }
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

  async findOne(id: string, token?: string) {
    const res = await this.eventDAL.findOne({
      where: { id: id },
      relations: ['trainers', 'documents', 'participants', 'event_dates', 'event_dates.event_sessions', 'event_dates.event_sessions.session_participant_maps', 'event_dates.event_sessions.session_participant_maps.participant']
    })

    if (res && res.location_id && token) {
      try {
        const locationDetails = await this.locationService.getLocationById(res.location_id, token);
        if (locationDetails) {
          res.region = locationDetails.region;
          res.zone = locationDetails.zone;
          res.woreda = locationDetails.woreda;
        } else {
          console.warn(`Location details not found for ID ${res.location_id} in event ${id}`);
        }
      } catch (error) {
        console.error(`Failed to fetch location names for event ${id}:`, error.message);
      }
    }

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
    const baseUrl = process.env.DYNAMIC_FORM_BASE_URL || 'http://13.50.253.205:3344/api/v1/dynamic-form';
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
      let locationDetails = '';
      if (event.location_id && token) {
        try {
          const loc = await this.locationService.getLocationById(event.location_id, token);
          if (loc) {
            locationDetails = `Location: ${loc.region}, ${loc.zone}, ${loc.woreda}`;
          }
        } catch (error) {
          console.error('Failed to fetch location for PDF:', error.message);
        }
      }

      if (Array.isArray(event.participants)) {
        event.participants = CapitalizeInterceptor.capitalizeData(event.participants);
        const priority: Record<string, number> = {
          [participant_type.LERSHA_AGENT.toLowerCase()]: 1,
          [participant_type.PARTNER.toLowerCase()]: 2,
          [participant_type.FARMER.toLowerCase()]: 3,
          [participant_type.EXTENSION_WORKERS.toLowerCase()]: 4,
          [participant_type.GOVERNMENT_OFFICIALS.toLowerCase()]: 5,
        };

        event.participants = event.participants.sort((a, b) => {
          const typeA = a.participant_type?.toLowerCase();
          const typeB = b.participant_type?.toLowerCase();

          const pA = (typeA && priority[typeA]) ? priority[typeA] : 6;
          const pB = (typeB && priority[typeB]) ? priority[typeB] : 6;

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

      const participantsPerPage = 12;
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
        const isDayBased = !!event.is_day_based;
        const totalSpan = isDayBased ? dateSet.length : dateSet.length * 2;
        const headerRowsCount = isDayBased ? 2 : 3;

        let rowNumber = 1;
        const numParticipantPages = Math.max(1, Math.ceil(participants.length / participantsPerPage));
        const totalPages = report ? numParticipantPages : numParticipantPages + 2;

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
          const i = pageIdx * participantsPerPage;
          const pageParticipants = i < participants.length ? participants.slice(i, i + participantsPerPage) : [];

          // FRESH objects for every page to avoid pdfmake reuse issues
          const headerRows: any[][] = [];

          if (isDayBased) {
            headerRows.push([
              { text: '#', rowSpan: 2, bold: true, alignment: 'center' },
              { text: 'Full Name', rowSpan: 2, bold: true, alignment: 'center' },
              { text: 'Gender', rowSpan: 2, bold: true, alignment: 'center' },
              { text: 'Role', rowSpan: 2, bold: true, alignment: 'center' },
              { text: 'Phone No', rowSpan: 2, bold: true, alignment: 'center' },
              { text: 'Signature', alignment: 'center', bold: true, colSpan: dateSet.length },
              ...Array(dateSet.length - 1).fill({})
            ]);
            headerRows.push([
              {}, {}, {}, {}, {},
              ...dateSet.map(date => ({ text: date, alignment: 'center', bold: true }))
            ]);
          } else {
            headerRows.push([
              { text: '#', rowSpan: 3, bold: true, alignment: 'center' },
              { text: 'Full Name', rowSpan: 3, bold: true, alignment: 'center' },
              { text: 'Gender', rowSpan: 3, bold: true, alignment: 'center' },
              { text: 'Role', rowSpan: 3, bold: true, alignment: 'center' },
              { text: 'Phone No', rowSpan: 3, bold: true, alignment: 'center' },
              { text: 'Signature', alignment: 'center', bold: true, colSpan: totalSpan },
              ...Array(totalSpan - 1).fill({})
            ]);
            headerRows.push([
              {}, {}, {}, {}, {},
              ...dateSet.flatMap(date => [{ text: date, alignment: 'center', bold: true, colSpan: 2 }, {}])
            ]);
            headerRows.push([
              {}, {}, {}, {}, {},
              ...dateSet.flatMap(() => [
                { text: 'Morning', alignment: 'center' },
                { text: 'Afternoon', alignment: 'center' }
              ])
            ]);
          }

          const tableBody: any[][] = [...headerRows];

          function normalizeStatus(status: any): 'present' | 'absent' | null {
            if (!status) return null;
            const s = String(status).toLowerCase();
            return (s === 'present' || s === attendance.PRESENT.toLowerCase()) ? 'present' :
              (s === 'absent' || s === attendance.ABSENT.toLowerCase()) ? 'absent' : null;
          }

          function displayCell(val: 'present' | 'absent' | null, isReport: boolean) {
            if (isReport && val === null) return { text: 'N/B' };
            if (isReport && val === 'present') return { text: 'P' };
            if (isReport && val === 'absent') return { text: 'A' };
            return { text: '' };
          }

          // Add participant rows
          for (const p of pageParticipants) {
            const attCols = dateSet.flatMap(date => {
              const eDate = event.event_dates.find(ed => new Date(ed.date).toLocaleDateString() === new Date(date).toLocaleDateString());
              if (!eDate) return isDayBased ? [displayCell(null, report)] : [displayCell(null, report), displayCell(null, report)];

              if (isDayBased) {
                const sess = (eDate.event_sessions || [])[0];
                const map = sess?.session_participant_maps?.find(m => m.participant?.id === p.id);
                return [displayCell(normalizeStatus(map?.attendance?.status), report)];
              } else {
                const ms = (eDate.event_sessions || []).find(s => s.session_type === 'morning');
                const as = (eDate.event_sessions || []).find(s => s.session_type === 'afternoon');
                const mP = ms?.session_participant_maps?.find(m => String(m.participant?.id).toLowerCase() === String(p.id).toLowerCase());
                const aP = as?.session_participant_maps?.find(m => String(m.participant?.id).toLowerCase() === String(p.id).toLowerCase());
                return [displayCell(normalizeStatus(mP?.attendance?.status), report), displayCell(normalizeStatus(aP?.attendance?.status), report)];
              }
            });

            tableBody.push([
              { text: String(rowNumber++) },
              { text: `${p.first_name ?? ''} ${p.father_name ?? ''}`.trim() || '-' },
              { text: p.gender ?? '-' },
              { text: p.participant_type ?? '-', alignment: 'center' },
              { text: p.phone ?? '-' },
              ...attCols
            ]);
          }

          // Add blank rows for remaining space
          const blanks = participantsPerPage - pageParticipants.length;
          for (let k = 0; k < blanks; k++) {
            tableBody.push([
              { text: String(rowNumber++) },
              { text: '' }, { text: '' }, { text: '' }, { text: '' },
              ...dateSet.flatMap(() => isDayBased ? [{ text: '' }] : [{ text: '' }, { text: '' }])
            ]);
          }

          const reportTypeIndicator = report ? reportType.ATT_REP : reportType.EMPTY_ATT;

          content.push(
            {
              columns: [{ image: logoBase64, width: 90 }],
              columnGap: 10,
              margin: [0, 0, 0, 5],
            },
            {
              text: 'Green Agro-Solution PLC (Lersha)',
              style: { fontSize: 18, bold: true },
              margin: [0, 0, 0, 2],
              alignment: 'center',
            },
            {
              text: `Project Name: ${projectName} `,
              style: { fontSize: 14 },
              margin: [0, 0, 0, 2],
              alignment: 'center',
            },
            {
              text: `${event.name} Attendance Sheet ${reportTypeIndicator}`,
              style: 'header',
              margin: [0, 2, 0, 8],
            },
            {
              table: {
                headerRows: headerRowsCount,
                widths: [25, '*', 50, 85, 85, ...dateSet.flatMap(() => isDayBased ? [65] : [65, 65])],
                body: tableBody
              },
              layout: {
                fillColor: (rowIndex: number) => (rowIndex < headerRowsCount ? '#F5F5F5' : null),
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                paddingTop: () => 5,
                paddingBottom: () => 5
              }
            }
          );

          if (!(dgIndex === dateGroups.length - 1 && pageIdx === totalPages - 1)) {
            content.push({ text: '', pageBreak: 'after' });
          }
        }
      }

      // Per Diem Sheet Generation
      const numPerDiemPages = Math.max(1, Math.ceil(participants.length / participantsPerPage));
      const totalPerDiemPages = report ? numPerDiemPages : numPerDiemPages + 2;

      for (let pageIdx = 0; pageIdx < totalPerDiemPages; pageIdx++) {
        const i = pageIdx * participantsPerPage;
        const pageParticipants = i < participants.length ? participants.slice(i, i + participantsPerPage) : [];

        let rowNum = i + 1;

        const tableBody: any[] = [
          [
            { text: '#', bold: true, alignment: 'center' },
            { text: 'Full Name', bold: true, alignment: 'center' },
            { text: 'Role', bold: true, alignment: 'center' },
            { text: 'Bank Name', bold: true, alignment: 'center' },
            { text: 'Bank Account', bold: true, alignment: 'center' },
            { text: 'Branch', bold: true, alignment: 'center' },
            { text: 'Signature', bold: true, alignment: 'center' },
          ]
        ];

        for (const p of pageParticipants) {
          tableBody.push([
            { text: String(rowNum++) },
            { text: `${p.first_name ?? ''} ${p.father_name ?? ''}`.trim() || '-' },
            { text: p.participant_type ?? '-', alignment: 'center' },
            { text: '' },
            { text: '' },
            { text: '' },
            { text: '' }
          ]);
        }

        const remainingRows = participantsPerPage - pageParticipants.length;
        for (let k = 0; k < remainingRows; k++) {
          tableBody.push([
            String(rowNum++),
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
            columns: [{ image: logoBase64, width: 90 }],
            columnGap: 10,
            margin: [0, 0, 0, 5],
            pageBreak: 'before'
          },
          {
            text: 'Green Agro-Solution PLC (Lersha)',
            style: { fontSize: 18, bold: true },
            margin: [0, 0, 0, 2],
            alignment: 'center',
          },
          {
            text: `Project Name: ${projectName} `,
            style: { fontSize: 14 },
            margin: [0, 0, 0, 2],
            alignment: 'center',
          },
          {
            text: `${event.name} Per Diem Sheet`,
            style: 'header',
            margin: [0, 2, 0, 8],
          },
          {
            table: {
              headerRows: 1,
              widths: [25, '*', 80, 100, 100, 100, 80],
              body: tableBody
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex < 1 ? '#F5F5F5' : null),
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingTop: () => 5,
              paddingBottom: () => 5
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

  async getEventsByParticipant(
    participantId: string,
  ): Promise<{ id: string; name: string; event_type: string; start_date: string | null; completed_date: string | null }[]> {

    const result = await this.eventDAL.findAll({
      where: {
        participants: {
          id: participantId,
        },
      },
      relations: ['participants', 'event_dates'],
      select: {
        id: true, name: true, type: true,
      },
    });

    if (!result.data || result.data.length === 0) {
      throw new NotFoundException(
        `No events found for participant with ID ${participantId}`,
      );
    }

    return result.data.map(event => {
      const dates = (event.event_dates || [])
        .filter(d => !d.is_deleted)
        .map(d => new Date(d.date))
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        id: event.id,
        name: event.name,
        event_type: event.type,
        start_date: dates[0] ? dates[0].toISOString().split('T')[0] : null,
        completed_date: dates[dates.length - 1] ? dates[dates.length - 1].toISOString().split('T')[0] : null,
      };
    });
  }
}