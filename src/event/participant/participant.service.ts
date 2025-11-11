import { Injectable ,NotFoundException} from '@nestjs/common';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';
import { FindManyOptions, IsNull } from 'typeorm';

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

 async findAllPaginated(
    page = 1,
    limit = 10,
  ): Promise<{ data: Participant[]; total: number; page: number; limit: number }> {
    const options: FindManyOptions<Participant> = {
       where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
    };
    return this.participantDAL.findPaginated(options, page, limit);
  }

  // async findAll(): Promise<Participant[]> {
  //   const participants = await this.participantDAL.findAll();
  //   return participants.filter((p) => !p.deleted_at);
  // }

  findOne(id: string) {
    return this.participantDAL.findById(id);
  }

 update(id: string, dto: UpdateParticipantDto, updated_by: string) {
  return this.participantDAL.update(id, {
    ...dto,
    updated_by,
    updated_at: new Date(),
  });
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

  await this.participantDAL.update(id, {
    deleted_by,
    deleted_at: new Date(),
  });
  return {
    message: 'Participant soft-deleted successfully',
    softDeleted: true,
  };
}
}
