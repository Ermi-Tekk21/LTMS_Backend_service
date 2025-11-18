import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query, Res, NotFoundException, InternalServerErrorException, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/common/fileHandler/MulterOption';
import { doc_type, event_status } from 'src/common/enums/status_enums';
import type { UUID } from 'crypto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Permission } from 'src/common/decorators/permission.decorator';
@UseGuards(JwtAuthGuard)
@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) { }
@Permission('create', 'event')
  @Post()
  @UseInterceptors(FileInterceptor('tor', multerOptions(true, ['pdf'], 20)))
  async create(
    @CurrentUser() user: any,
    @Body("data") data: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedData: CreateEventDto = JSON.parse(data)
    return this.eventService.create(parsedData,file,user);
  }
@Permission('read', 'event')
  @Get()
  findAll(
    @Query('searchTerm') searchTerm?: string,
    @Query('searchFields') searchFields?: string,
    @Query('status') status?: event_status,
    @Query('locationId') locationId?: UUID,
    @Query('projectId') projectId?: UUID,
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
      status: status,
      locationId: locationId,
      projectId: projectId,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      order: parsedOrder,
    });
  }
@Permission('read', 'event')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }
@Permission('read', 'event')
  @Get('docs/:id')
  eventDosPath(
    @Param('id') id: string,
    @Query('doc-type') docType?: doc_type
  ) {
    return this.eventService.eventDocsPath(id, docType);
  }
@Permission('update', 'event')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto,@CurrentUser() user: any,) {
    return this.eventService.update(id, updateEventDto);
  }
@Permission('update', 'event')
  @Patch(':id/replace-tor')
  @UseInterceptors(FileInterceptor('tor', multerOptions(true, ['pdf'], 20)))
  replaceTOR(
    @Param('id') id: UUID,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.eventService.replaceTOR(id, file);
  }
@Permission('manage', 'trainer')
  @Post(':id/trainers')
  async assignTrainers(
    @CurrentUser() user: any,
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.assignTrainersToEvent(eventId, trainerIds);
  }
@Permission('manage', 'trainer')
  @Delete(':id/trainers')
  async removeTrainers(
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.removeTrainersFromEvent(eventId, trainerIds);
  }
@Permission('manage', 'trainer')
  @Patch(':id/trainers')
  async updateTrainers(
    @Param('id') eventId: string,
    @Body('trainerIds') trainerIds: string[],
  ) {
    return this.eventService.updateTrainersForEvent(eventId, trainerIds);
  }
@Permission('manage', 'trainer')
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
@Permission('manage', 'participant')
  @Post(':id/participants')
  async assignParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.assignParticipantsToEvent(eventId, participantIds);
  }
@Permission('manage', 'participant')
  @Delete(':id/participants')
  async removeParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.removeParticipantsFromEvent(eventId, participantIds);
  }
@Permission('manage', 'participant')
  @Patch(':id/participants')
  async updateParticipants(
    @Param('id') eventId: string,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.eventService.updateParticipantsForEvent(eventId, participantIds);
  }
@Permission('manage', 'participant')
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

@Permission('delete', 'event')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
@Permission('read', 'event')
  @Get('attendance/:eventId/pdf')
  async downloadAttendancePdf(
    @Param('eventId') eventId: string,
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    try {
      const pdfBuffer = await this.eventService.generateAttendancePdf(eventId, date);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="attendance-${eventId}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (error instanceof NotFoundException) {
        throw error
      } else {
        throw new InternalServerErrorException("unable to generate pdf")
      }
    }
  }
}


