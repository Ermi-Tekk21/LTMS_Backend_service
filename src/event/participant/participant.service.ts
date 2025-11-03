import { Injectable } from '@nestjs/common';
import { ParticipantDAL } from 'src/common/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';

@Injectable()
export class ParticipantService {
  constructor(private readonly participantDAL: ParticipantDAL) {}

  create(dto: CreateParticipantDto) {
    return this.participantDAL.create(dto);
  }

  findAll() {
    return this.participantDAL.findAll();
  }

  findOne(id: string) {
    return this.participantDAL.findById(id);
  }

  update(id: string, dto: UpdateParticipantDto) {
    return this.participantDAL.update(id, dto);
  }

  remove(id: string) {
    return this.participantDAL.delete(id);
  }
}
