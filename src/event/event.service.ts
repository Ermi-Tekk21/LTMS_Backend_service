import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, In, Repository } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { DocumentService } from 'src/document/document.service';
import { doc_type, event_status } from 'src/common/enums/status_enums';
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
import { UpdateDateParticipantMapDto, UpdateDateParticipantStatusDto, UpdateSessionParticipantStatusDto } from './event_session/dto/update-manual-att.dto';
import { promises } from 'dns';

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
        is_day_based: dto.is_day_based
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
          ends_at: morningEnd
        }, queryRunner);
        //afternoon session
        await this.eventSessionService.create({
          event_date: eventDate,
          venue: event.venue,
          starts_at: afternoonStart,
          ends_at: afternoonEnd
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
          created_by,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async replaceTOR(id: UUID, file: Express.Multer.File) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

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
      await this.documentService.remove(event.documents.filter(docs => docs.doc_type == doc_type.TOR)[0].id)

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

      // No dto here - replaceTOR only replaces the TOR document.
      await queryRunner.manager.save(event);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'TOR replaced successfully',
        data: {
          event,
          torDocument: uploadedFile,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to replace TOR for event: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto) {
    const event = await this.findOne(id)
    if (!event) {
      throw new NotFoundException('event to be updated not found...')
    }

    const { trainers, event_dates, ...eventData } = updateEventDto;

    // Update scalar properties
    if (Object.keys(eventData).length > 0) {
      await this.eventDAL.update(id, eventData);
    }

    // Update event_dates relation
    if (event_dates) {
      for (const event_date of event.event_dates) {
        await this.eventDateService.remove(event_date.id)
      }
      for (const date of event_dates) {
        const eventDate = await this.eventDateService.create(
          { date, event }
        );
        await this.eventSessionService.create({
          event_date: eventDate,
          venue: event.venue,
        });
      }
    }

    // Return the updated event with relations
    return this.findOne(id);
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
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
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

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
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
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
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

  // REMOVE PARTICIPANTS FROM EVENT
  async removeParticipantsFromEvent(eventId: string, participantIds: string[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const eventRepo = queryRunner.manager.getRepository(Event);

      const event = await eventRepo.findOne({
        where: { id: eventId },
        relations: ['participants'],
      });
      if (!event) throw new NotFoundException('Event not found');

      event.participants = event.participants.filter(
        (participant) => !participantIds.includes(participant.id),
      );
      const updatedEvent = await eventRepo.save(event);

      await queryRunner.commitTransaction();
      return updatedEvent;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
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
  }

  async findOne(id: string) {
    return await this.eventDAL.findOne({
      where: { id: id },
      relations: ['trainers', 'documents', 'participants', 'event_dates', 'event_dates.event_sessions', 'event_dates.event_sessions.session_participant_maps', 'event_dates.event_sessions.session_participant_maps.participant']
    })
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

    const paths = filteredDocs.map(doc => doc.path);

    const presignedUrls = await Promise.all(
      paths.map(path => this.documentService.viewDoc(path))
    );

    return presignedUrls;
  }

  async remove(id: string) {
    try {
      const event = await this.findOne(id)
      if (!event) {
        throw new NotFoundException("event to be deleted not found...")
      }
      if (event.event_status != event_status.INITATED) {
        throw new BadRequestException('only event with status initiated can be deleted...')
      }
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

  async getImageBase64(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const ext = url.split('.').pop();
    return `data:image/${ext};base64,${base64}`;
  }

  async getAccessToken(): Promise<string> {
    const url = process.env.AUTH_URL || 'http://164.160.187.141:3344/api/v1/auth/login'
    const email = process.env.AUTH_EMAIL || 'admin@lersha.com'
    const password = process.env.AUTH_PASSWORD || 'Admin@123'

    // Validate required environment variables to narrow types to string
    if (!url) {
      throw new InternalServerErrorException('AUTH_URL is not configured');
    }
    if (!email || !password) {
      throw new InternalServerErrorException('AUTH_EMAIL and AUTH_PASSWORD must be configured');
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (process.env.AUTHORIZATION_HEADER) {
        headers['Authorization'] = process.env.AUTHORIZATION_HEADER;
      }

      const resp = await axios.post(url, { email, password }, { headers });

      // common token shapes: access_token, token, data.access_token
      const token =
        resp?.data?.access_token ||
        resp?.data?.token ||
        resp?.data?.data?.access_token ||
        resp?.data?.data?.token;

      if (!token) {
        throw new InternalServerErrorException('Authentication response did not contain an access token');
      }

      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to get access token: ${msg}`);
    }
  }

  async getProjectName(token: string, projectId: UUID) {
    const baseUrl = process.env.DYNAMIC_FORM_BASE_URL || 'http://164.160.187.141:3344/api/v1/dynamic-form';
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

      return String(projectName);
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Failed to get project name: ${msg}`);
    }
  }

  async generateAttendancePdf(eventId: string): Promise<Buffer> {
    const event = await this.eventDAL.findOne({
      where: { id: eventId },
      relations: ['participants', 'event_dates'],
    });

    // const token = await this.getAccessToken();
    // console.log(token);

    if (!event) throw new Error('Event not found');

    const projectName = await this.getProjectName("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ZDBkNTE1OS1iZDEyLTQwMWEtOTA5ZC00ZGViYWY4ZTVjNzciLCJzZXNzaW9uSWQiOiIxNmI4MjZmZC03MDcxLTQ1N2EtYWNkYi0yNTQwNDgwYjNmMDciLCJpYXQiOjE3NjM5OTI0NjAsImV4cCI6MTc2NDA3ODg2MH0.MFuz8GTLhhGnWtI3zFguQJmuwfcJKUfx02PHS22R91k", event.project_id as UUID);

    // Capitalize participant data for consistent display in PDF
    if (Array.isArray(event.participants)) {
      event.participants = CapitalizeInterceptor.capitalizeData(event.participants);
      event.participants = event.participants.sort((a, b) =>
        a.first_name.localeCompare(b.first_name, undefined, { sensitivity: 'base' })
      );
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
    const datesPerPage = 3;

    const participants = event.participants || [];
    const eventDates = (event.event_dates || []).map(d => {
      // normalize date to readable string
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

    // Create table for each group of dates
    for (let dgIndex = 0; dgIndex < dateGroups.length; dgIndex++) {
      const dateSet = dateGroups[dgIndex];

      let rowNumber = 1;

      // Header
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

      // Build headers
      let headerRow1: any[];
      let headerRow2: any[] | undefined;
      let tableHeader: any[][];
      let headerRowsCount: number;

      if (isDayBased) {
        headerRow1 = [
          { text: '#', bold: true, alignment: 'center' },
          { text: 'Full Name', bold: true, alignment: 'center' },
          { text: 'Gender', bold: true, alignment: 'center' },
          { text: 'Phone No', bold: true, alignment: 'center' },
          { text: 'Signature', alignment: 'center', bold: true, colSpan: dateSet.length },
        ];
        for (let i = 1; i < dateSet.length; i++) headerRow1.push({});

        headerRow2 = [
          {},
          {},
          {},
          {},
          ...dateSet.flatMap(date => ({ text: date, alignment: 'center', bold: true }))
        ];
        tableHeader = [headerRow1, headerRow2];
        headerRowsCount = 2;
      } else {
        const totalSpan = dateSet.length * 2;
        headerRow1 = [
          { text: '#', rowSpan: 3, bold: true, alignment: 'center' },
          { text: 'Full Name', rowSpan: 3, bold: true, alignment: 'center' },
          { text: 'Gender', rowSpan: 3, bold: true, alignment: 'center' },
          { text: 'Phone No', rowSpan: 3, bold: true, alignment: 'center' },
          { text: 'Signature', alignment: 'center', bold: true, colSpan: totalSpan },
        ];
        for (let i = 1; i < totalSpan; i++) headerRow1.push({});

        headerRow2 = [
          {},
          {},
          {},
          {},
          ...dateSet.flatMap(date => ([
            { text: date, alignment: 'center', bold: true, colSpan: 2 },
            {}
          ]))
        ];

        const headerRow3 = [
          {},
          {},
          {},
          {},
          ...dateSet.flatMap(() => ([
            { text: 'Morning', alignment: 'center' },
            { text: 'Afternoon', alignment: 'center' }
          ]))
        ];

        tableHeader = [headerRow1, headerRow2, headerRow3];
        headerRowsCount = 3;
      }

      // Participant pages for this date group
      for (let i = 0; i < participants.length; i += participantsPerPage) {
        const pageParticipants = participants.slice(i, i + participantsPerPage);
        const tableBody: any[] = [...tableHeader];

        for (let j = 0; j < pageParticipants.length; j++) {
          const p = pageParticipants[j];
          tableBody.push([
            String(rowNumber++),
            `${p.first_name ?? ''} ${p.father_name ?? ''}`.trim(),
            p.gender ?? '',
            p.phone ?? '',
            ...dateSet.flatMap(() => isDayBased ? [''] : ['', ''])
          ]);
        }

        const remainingRows = participantsPerPage - pageParticipants.length;
        for (let k = 0; k < remainingRows; k++) {
          tableBody.push([
            String(rowNumber++),
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
            ...dateSet.flatMap(() => isDayBased ? [''] : ['', ''])
          ]);
        }

        content.push(
          {
            text: `${event.name} Attendance Sheet`,
            style: 'header',
            margin: [0, 5, 0, 15],
          },
          {
            table: {
              headerRows: headerRowsCount,
              widths: [
                15,
                '*',
                48,
                68,
                ...dateSet.flatMap(() => isDayBased ? [50] : [50, 50])
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

    // ensure session maps exist before generating (if required)
    await this.participantSessionMap(eventId);

    return new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
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
      console.log(event);
      console.log(sessionParticipanrMaps);

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }

      // Assuming sessionParticipanrMaps contains { sessionParticipantMapId, status }
      for (const item of sessionParticipanrMaps) {
        const map = await queryRunner.manager.findOne(SessionParticipantMap, {
          where: { id: item.sessionParticipantMapId },
          relations: ['event_session', 'event_session.event_date']
        });

        console.log("map: ", map);

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
        map.attendance = { ...map.attendance, status: item.status };
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
      throw error;
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

          if (map) {
            map.attendance = { ...map.attendance, status: item.status };
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
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
