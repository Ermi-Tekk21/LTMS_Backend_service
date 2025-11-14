import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards,Query,Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
// import { PermissionGuard } from 'src/common/guards/permission.guard';
import { Permission } from 'src/common/decorators/permission.decorator';

@Controller('participant') 

// @UseGuards(JwtAuthGuard)
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}
@Permission('create', 'participant')
@Post(':eventId')
async createParticipant(
  @Param('eventId') eventId: string,
  @Body() dto: CreateParticipantDto,
  @CurrentUser() currentUser: any,
) {
  return this.participantService.create(dto, currentUser.id, eventId);
}

@Permission('read', 'participant')
 @Get()
async getAllParticipants(
  @Query('page') page = 1,
  @Query('limit') limit = 10,
  @Query('search') search?: string,
) {
  return this.participantService.findAll(Number(page), Number(limit), search);
}

// @Permission('manage', 'participant')
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
// @Permission('create', 'participant')
   @Post('upload/:eventId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @Param('eventId') eventId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    if (!eventId) {
      throw new BadRequestException('Event ID is required.');
    }

    try {
      const result = await this.participantService.importFromExcel(
        file,
        eventId,
        userId,
      );
      return {
        message: 'Excel file imported successfully',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to import Excel: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
@Permission('read', 'participant')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.participantService.findOne(id);
  }
@Permission('update', 'participant')
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
