import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/common/fileHandler/MulterOption';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) { }

  @Post()
  @UseInterceptors(FileInterceptor('TOR', multerOptions(true, ['pdf'], 20)))
  async create(
    @Body("data") data: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsedData: CreateEventDto = JSON.parse(data)
    return this.eventService.create(parsedData, file);
  }

  @Get()
  findAll() {
    return this.eventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventService.findOne(id);
  }

  @Get('tor/view-doc')
  viewDoc() {
    return this.eventService.viewDoc();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}


