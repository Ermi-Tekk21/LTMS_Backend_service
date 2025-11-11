import { Injectable } from '@nestjs/common';
import { UpdateEventDateDto } from './dto/update-event_date.dto';
import { EventDateDal } from './dal/event_date.dal';
import { DeepPartial, QueryRunner } from 'typeorm';
import { EventDate } from './entities/event_date.entity';

@Injectable()
export class EventDateService {
  constructor(private readonly eventDateDAL: EventDateDal) { }

  async create(data: DeepPartial<EventDate>, queryRunner?: QueryRunner): Promise<EventDate> {
    try {
      return await this.eventDateDAL.create(data, queryRunner);
    } catch (error) {
      throw new Error(`EventDateService.create failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  findAll() {
    return `This action returns all eventDate`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventDate`;
  }

  update(id: number, updateEventDateDto: UpdateEventDateDto) {
    return `This action updates a #${id} eventDate`;
  }

  remove(id: string) {
    return this.eventDateDAL.delete(id)
  }
}
