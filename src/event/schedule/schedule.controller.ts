import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateEventDateDto } from './dto/create-event.dto';
import { UpdateEventDateDto } from './dto/update-event.dto';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  create(@Body() CreateEventDateDto: CreateEventDateDto) {
    return this.scheduleService.create(CreateEventDateDto);
  }

  @Get()
  findAll() {
    return this.scheduleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() UpdateEventDateDto: UpdateEventDateDto) {
    return this.scheduleService.update(+id, UpdateEventDateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduleService.remove(+id);
  }
}
