import { Injectable ,ConflictException} from '@nestjs/common';
import { ParticipantDAL } from 'src/common/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
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
