import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards,Query,Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
@Controller('participant') 
@UseGuards(JwtAuthGuard)
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Post()
  create(@Body() createParticipantDto: CreateParticipantDto, @CurrentUser('userId') userId: string) {
  return this.participantService.create(createParticipantDto, userId);
 }

  // @Get()
  // getAll() {
  //   return this.participantService.findAll();
  // }

 @Get()
async getAllParticipants(
  @Query('page') page = 1,
  @Query('limit') limit = 10,
  @Query('search') search?: string,
) {
  return this.participantService.findAll(Number(page), Number(limit), search);
}

   @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.participantService.generateTemplate();

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="participant_template.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  }
  
   @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('eventId') eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    if (!eventId) {
      throw new BadRequestException('Event ID is required.');
    }

    try {
      const result = await this.participantService.importFromExcel(file, eventId, userId);
      return {
        message: 'Excel file imported successfully',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to import Excel: ${error.message}`);
    }
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.participantService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateParticipantDto: UpdateParticipantDto,@CurrentUser('userId') userId: string) {
    return this.participantService.update(id, updateParticipantDto,userId);
  }

  // permanent delete
  // @Delete('delete/:id')
  // delete(@Param('id') id:string,){
  // return this.participantService.remove(id)
  // }
  
  @Delete(':id')
  remove(@Param('id') id: string,@CurrentUser('userId') userId: string) {
  return this.participantService.softDelete(id,userId);
  }
}
