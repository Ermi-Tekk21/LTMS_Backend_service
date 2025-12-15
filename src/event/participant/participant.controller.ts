import {
  Controller,
  Get,
  Req,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Permission } from 'src/common/decorators/permission.decorator';
import { IncomingHttpHeaders } from 'http';

@Controller('participant')
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  // ---------------- CREATE PARTICIPANT ----------------

  @Permission('create', 'participant')
  @Post(':eventId')
  async createParticipant(
    @Param('eventId') eventId: string,
    @Body() dto: CreateParticipantDto,
    @CurrentUser() currentUser: any,
    @Req() req: Request,
  ) {
    // Safe token extraction
    const headers = req.headers as IncomingHttpHeaders;
    const authHeader = headers.authorization || (headers as any).Authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;

    if (!token) {
      throw new BadRequestException('Authorization token is missing.');
    }

    return this.participantService.create(dto, currentUser.id, eventId, token);
  }

  // ---------------- GET ALL ----------------

  @Permission('read', 'participant')
  @Get()
  async getAllParticipants(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.participantService.findAll(
      Number(page),
      Number(limit),
      search,
    );
  }


  @Permission('create', 'participant')
  @Get('template')
  async downloadTemplate(@Req() req: Request, @Res() res: Response) {
    const headers = req.headers as IncomingHttpHeaders;
    const authHeader = headers.authorization || (headers as any).Authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;

    const buffer = await this.participantService.generateTemplate(token);

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="participant_template.xlsx"',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.end(buffer);
  }


 @Permission('create', 'participant')
@Post('upload/:eventId')
@UseInterceptors(FileInterceptor('file'))
async uploadExcel(
  @Param('eventId') eventId: string,
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser('userId') userId: string,
  @Req() req: Request,
) {
  if (!file) {
    throw new BadRequestException('No file uploaded.');
  }

  if (!eventId) {
    throw new BadRequestException('Event ID is required.');
  }

  //  Extract token safely from headers
  const authHeader = req.headers['authorization'] as string | undefined;
  if (!authHeader) {
    throw new BadRequestException('Authorization token is missing');
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  try {
    const result = await this.participantService.importFromExcel(
      file,
      eventId,
      userId,
      token,
    );

    return {
      message: 'Excel file imported successfully.',
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
  update(
    @Param('id') id: string,
    @Body() updateParticipantDto: UpdateParticipantDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.participantService.update(id, updateParticipantDto, userId);
  }


  @Permission('delete', 'participant')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.participantService.softDelete(id, userId);
  }
}
