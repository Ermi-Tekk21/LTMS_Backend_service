import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/common/fileHandler/MulterOption';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) { }

  @Post()
  @UseInterceptors(FileInterceptor('tor', multerOptions(true, ['pdf'], 20)))
  async create(
    @Body("data") data: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedData: CreateEventDto = JSON.parse(data)
    return this.eventService.create(parsedData, file);
  }

  @Get()
  findAll(
    @Query('searchTerm') searchTerm?: string,
    @Query('searchFields') searchFields?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('order') order?: string,
  ) {
    // Convert comma-separated fields (e.g., "name,description") into an array
    const parsedFields = searchFields ? searchFields.split(',') : [];

    // Convert order string (e.g., "createdAt:desc,name:asc") into an object
    const parsedOrder = order
      ? Object.fromEntries(order.split(',').map((o) => o.split(':')))
      : undefined;

    return this.eventService.findAll({
      searchTerm,
      searchFields: parsedFields,
      page: Number(page),
      limit: Number(limit),
      order: parsedOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.update(id, updateEventDto);
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
  async getEventTrainers(
    @Param('id') eventId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,) 
  {
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
    return this.eventService.getEventTrainers(eventId);
  }

  @Post(':id/participants')
  async assignParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.assignParticipantsToEvent(eventId, participantIds);
  }

  @Delete(':id/participants')
  async removeParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.removeParticipantsFromEvent(eventId, participantIds);
  }

  @Patch(':id/participants')
  async updateParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.updateParticipantsForEvent(eventId, participantIds);
  }

  @Get(':id/participants')
async getEventParticipants(
  @Param('id') eventId: string,
  @Query('page') page = 1,
  @Query('limit') limit = 10,
) {
  // Convert page and limit to numbers
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;

  return this.eventService.getEventParticipants(eventId, pageNumber, limitNumber);
}


  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}


