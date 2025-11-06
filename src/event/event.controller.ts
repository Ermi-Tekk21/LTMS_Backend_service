import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventService.create(createEventDto);
  }

  @Get()
  findAll() {
    return this.eventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.update(+id, updateEventDto);
  }

   @Post(':id/trainers')
  async assignTrainers(
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.assignTrainersToEvent(eventId, trainerIds);
  }
  
  @Delete(':id/trainers')
  async removeTrainers(
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.removeTrainersFromEvent(eventId, trainerIds);
  }

  @Patch(':id/trainers')
  async updateTrainers(
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.updateTrainersForEvent(eventId, trainerIds);
  }

  @Get(':id/trainers')
  async getEventTrainers(@Param('id') eventId: string) {
    return this.eventService.getEventTrainers(eventId);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(+id);
  }
}
