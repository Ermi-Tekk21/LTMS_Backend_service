import { Injectable } from '@nestjs/common';
import { UpdateEventSessionDto } from './dto/update-event_session.dto';
import { EventSessionDal } from './dal/event_session.dal';
import { DeepPartial, QueryRunner } from 'typeorm';
import { EventSession } from './entities/event_session.entity';


@Injectable()
export class EventSessionService {
  constructor(private readonly eventSessionDAL: EventSessionDal) {}

  async create(data: DeepPartial<EventSession>, queryRunner?: QueryRunner): Promise<EventSession> {
    try {
      return await this.eventSessionDAL.create(data, queryRunner);
    } catch (error) {
      throw new Error(`EventSessionService.create failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  findAll() {
    return `This action returns all eventSession`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventSession`;
  }

  update(id: number, updateEventSessionDto: UpdateEventSessionDto) {
    return `This action updates a #${id} eventSession`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventSession`;
  }
}
