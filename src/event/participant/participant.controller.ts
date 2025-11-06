import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards,Query } from '@nestjs/common';
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

  // @Get()
  // getAll() {
  //   return this.participantService.findAll();
  // }

 @Get()
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.participantService.findAllPaginated(page, limit);
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
