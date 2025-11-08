import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, QueryRunner, In } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from './event_date/event_date.service';
import { EventSessionService } from './event_session/event_session.service';
import { TrainerService } from './trainer/trainer.service';
import { Trainer } from './trainer/entities/trainer.entity';
import { Event } from './entities/event.entity';
import { Participant } from './participant/entities/participant.entity';
import { EmailService } from 'src/common/notification/email.service';


@Injectable()
export class EventService {
  constructor(
    private readonly eventDAL: EventDAL,
    private readonly eventDateService: EventDateService,
    private readonly eventSessionService: EventSessionService,
    private readonly trainerService: TrainerService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) { }

  async create(dto: CreateEventDto) {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const event = await this.eventDAL.create(dto, queryRunner)
      for (const dateDto of dto.event_dates || []) {
        const eventDate = await this.eventDateService.create(
          { ...dateDto, id: event.id },
          queryRunner,
        );

        for (const sessionDto of dateDto.date_sessions || []) {
          await this.eventSessionService.create(
            { ...sessionDto, id: eventDate.id },
            queryRunner,
          );
        }
      }

      await queryRunner.commitTransaction();
      return event;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
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

      const trainers = await trainerRepo.findBy({ id: In(trainerIds) });
      event.trainers = trainers;
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

   async getEventTrainers(eventId: string) {
    const event = await this.dataSource.getRepository(Event).findOne({
      where: { id: eventId },
      relations: ['trainers'],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event.trainers;
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
async assignParticipantsToEvent(eventId: string, participantIds: string[]) {
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

    event.participants = [...event.participants, ...participants];
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
async getEventParticipants(eventId: string) {
  const event = await this.dataSource.getRepository(Event).findOne({
    where: { id: eventId },
    relations: ['participants'],
  });
  if (!event) throw new NotFoundException('Event not found');
  return event.participants;
}

  findAll() {
    return `This action returns all event`;
  }

  findOne(id: number) {
    return `This action returns a #${id} event`;
  }

  update(id: number, updateEventDto: UpdateEventDto) {
    return `This action updates a #${id} event`;
  }

  remove(id: number) {
    return `This action removes a #${id} event`;
  }
}
