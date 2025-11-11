import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from '../../../common/dal/base.dal';
import { Participant } from 'src/event/participant/entities/participant.entity';

@Injectable()
export class ParticipantDAL extends BaseDAL<Participant> {
    // save: any;
    constructor(
        @InjectRepository(Participant)
        repo: Repository<Participant>,
    ) {
        super(repo);
    }
}
