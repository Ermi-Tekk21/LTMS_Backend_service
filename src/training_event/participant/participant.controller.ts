import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ParticipantService } from './participant.service';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';

@Controller()
export class ParticipantController {
  constructor(private readonly participantService: ParticipantService) {}

  @MessagePattern('createParticipant')
  create(@Payload() createParticipantDto: CreateParticipantDto) {
    return this.participantService.create(createParticipantDto);
  }

  @MessagePattern('findAllParticipant')
  findAll() {
    return this.participantService.findAll();
  }

  @MessagePattern('findOneParticipant')
  findOne(@Payload() id: number) {
    return this.participantService.findOne(id);
  }

  @MessagePattern('updateParticipant')
  update(@Payload() updateParticipantDto: UpdateParticipantDto) {
    return this.participantService.update(updateParticipantDto.id, updateParticipantDto);
  }

  @MessagePattern('removeParticipant')
  remove(@Payload() id: number) {
    return this.participantService.remove(id);
  }
}
