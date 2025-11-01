import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Participant } from './entities/participant.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ParticipantDAL {
    constructor(
        @InjectRepository(Participant)
        private readonly participantRepository: Repository<Participant>,
    ) { }

    async create(data: Partial<Participant>): Promise<Participant> {
        const participant = this.participantRepository.create(data);
        return this.participantRepository.save(participant);
    }

    async findAll(): Promise<Participant[]> {
        return this.participantRepository.find();
    }

    async findById(id: string): Promise<Participant | null> {
        return this.participantRepository.findOne({ where: { id } });
    }

    async update(id: string, data: Partial<Participant>): Promise<Participant | null> {
        await this.participantRepository.update(id, data);
        return this.findById(id);
    }

    async remove(id: string): Promise<void> {
        await this.participantRepository.delete(id);
    }

    async findByEmail(email: string): Promise<Participant | null> {
        return this.participantRepository.findOne({ where: { email } });
    }
}
