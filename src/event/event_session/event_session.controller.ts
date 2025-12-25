import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventSessionService } from './event_session.service';
import { CreateEventSessionDto } from './dto/create-event_session.dto';
import { UpdateEventSessionDto } from './dto/update-event_session.dto';

@Controller('event-session')
export class EventSessionController {
  constructor(private readonly eventSessionService: EventSessionService) {}

  @Post()
  create(@Body() createEventSessionDto: CreateEventSessionDto) {
    return this.eventSessionService.create(createEventSessionDto);
  }

  @Get()
  findAll() {
    return this.eventSessionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventSessionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventSessionDto: UpdateEventSessionDto) {
    return this.eventSessionService.update(+id, updateEventSessionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventSessionService.remove(+id);
  }
}
