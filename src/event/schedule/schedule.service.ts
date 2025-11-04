import { Injectable } from '@nestjs/common';
import { CreateEventDateDto } from './dto/create-event.dto';
import { UpdateEventDateDto } from './dto/update-event.dto';

@Injectable()
export class ScheduleService {
  create(CreateEventDateDto: CreateEventDateDto) {
    return 'This action adds a new schedule';
  }

  findAll() {
    return `This action returns all schedule`;
  }

  findOne(id: number) {
    return `This action returns a #${id} schedule`;
  }

  update(id: number, UpdateEventDateDto: UpdateEventDateDto) {
    return `This action updates a #${id} schedule`;
  }

  remove(id: number) {
    return `This action removes a #${id} schedule`;
  }
}
