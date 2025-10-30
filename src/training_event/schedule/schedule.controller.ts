import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Controller()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @MessagePattern('createSchedule')
  create(@Payload() createScheduleDto: CreateScheduleDto) {
    return this.scheduleService.create(createScheduleDto);
  }

  @MessagePattern('findAllSchedule')
  findAll() {
    return this.scheduleService.findAll();
  }

  @MessagePattern('findOneSchedule')
  findOne(@Payload() id: number) {
    return this.scheduleService.findOne(id);
  }

  @MessagePattern('updateSchedule')
  update(@Payload() updateScheduleDto: UpdateScheduleDto) {
    return this.scheduleService.update(updateScheduleDto.id, updateScheduleDto);
  }

  @MessagePattern('removeSchedule')
  remove(@Payload() id: number) {
    return this.scheduleService.remove(id);
  }
}
