import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ParticipantDAL } from './participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
// import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';

@Injectable()
export class ParticipantService {
  constructor(private readonly participantDAL: ParticipantDAL) {}
  async create(dto: CreateParticipantDto): Promise<Participant> {
    // Check for duplicate email
    const existing = await this.participantDAL.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(`Participant with email ${dto.email} already exists.`);
    }

    // Create new participant
    return this.participantDAL.create({
      ...dto,
      is_deleted: false,
      created_at: new Date(),
    });
  }


  async findAll(): Promise<Participant[]> {
    const participants = await this.participantDAL.findAll();
    return participants.filter((p) => !p.is_deleted);
  }

  
  async findOne(id: string): Promise<Participant> {
    const participant = await this.participantDAL.findById(id);
    if (!participant || participant.is_deleted) {
      throw new NotFoundException(`Participant with ID ${id} not found`);
    }
    return participant;
  }


  async remove(id: string): Promise<{ message: string }> {
    const participant = await this.participantDAL.findById(id);
    if (!participant) {
      throw new NotFoundException(`Participant with ID ${id} not found`);
    }

    await this.participantDAL.update(id, {
      is_deleted: true,
      deleted_at: new Date(),
    });

    return { message: `Participant with ID ${id} has been soft deleted.` };
  }

  
}
