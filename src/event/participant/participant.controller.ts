import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('participant')
@UseGuards(JwtAuthGuard)
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @Post()
  create(@Body() createParticipantDto: CreateParticipantDto, @CurrentUser('userId') userId: string) {
  return this.participantService.create(createParticipantDto, userId);
 }

  @Get()
  findAll() {
    return this.participantService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.participantService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateParticipantDto: UpdateParticipantDto) {
    return this.participantService.update(id, updateParticipantDto);
  }

  @Delete('delete/:id')
  delete(@Param('id') id:string,){
  return this.participantService.remove(id)
  }
  
  @Delete(':id')
  remove(@Param('id') id: string,@CurrentUser('userId') userId: string) {
  return this.participantService.softDelete(id,userId);
  }
}
