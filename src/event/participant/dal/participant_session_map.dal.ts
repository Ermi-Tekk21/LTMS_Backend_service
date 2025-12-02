import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from 'src/common/dal/base.dal';
import { SessionParticipantMap } from 'src/event/participant/entities/sessionParticipantMap.entity';

@Injectable()
export class ParticipantSessionMapDal extends BaseDAL<SessionParticipantMap> {
    constructor(
        @InjectRepository(SessionParticipantMap)
        repo: Repository<SessionParticipantMap>,
    ) {
        super(repo);
    }
}
