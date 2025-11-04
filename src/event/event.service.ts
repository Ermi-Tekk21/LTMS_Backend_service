import { Injectable } from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DataSource, QueryRunner } from 'typeorm';
import { EventDAL } from './dal/event.dal';
import { EventDateService } from 'src/event_date/event_date.service';
import { EventSessionService } from 'src/event_session/event_session.service';

@Injectable()
export class EventService {
  constructor(
    private readonly eventDAL: EventDAL,
    private readonly eventDateService: EventDateService,
    private readonly eventSessionService: EventSessionService,
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
          { ...dateDto, event_id: event.id },
          queryRunner,
        );

        for (const sessionDto of dateDto.date_sessions || []) {
          await this.eventSessionService.create(
            { ...sessionDto, event_date_id: eventDate.id },
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
