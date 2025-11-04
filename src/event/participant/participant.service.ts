import { Injectable ,  NotFoundException} from '@nestjs/common';
import { ParticipantDAL } from 'src/common/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';

@Injectable()
export class ParticipantService {
  constructor(private readonly participantDAL: ParticipantDAL) {}
  async create(dto: CreateParticipantDto, created_by: string): Promise<Participant> {
  
    // Create new participant
    return this.participantDAL.create({
      ...dto,
      created_by: created_by,
      created_at: new Date(),
    });
  }


  async findAll(): Promise<Participant[]> {
    const participants = await this.participantDAL.findAll();
    return participants.filter((p) => !p.deleted_at);
  }

  findOne(id: string) {
    return this.participantDAL.findById(id);
  }

  update(id: string, dto: UpdateParticipantDto) {
    return this.participantDAL.update(id, dto);
  }

async remove(id: string) {
  const existing = await this.participantDAL.findById(id);
  if (!existing ) {
    throw new NotFoundException(`Participant with id ${id} not found.`);
  }
  await this.participantDAL.delete(id);
  return { message: 'user deleted successfully' };
}

async softDelete(id: string, deleted_by: string) {
  const existing = await this.participantDAL.findById(id);

  if (!existing) {
    throw new NotFoundException(`Participant with id ${id} not found.`);
  }

  if (existing.is_deleted) {
    return { message: 'Participant already soft-deleted.', softDeleted: true };
  }

  await this.participantDAL.softDelete(id,deleted_by);
  return {
    message: 'Participant soft-deleted successfully',
    softDeleted: true,
  };
}

  
}
