import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from '../../common/dal/base.dal';
import { EventSession } from '../entities/event_session.entity';

@Injectable()
export class EventSessionDal extends BaseDAL<EventSession> {
    constructor(
        @InjectRepository(EventSession)
        repo: Repository<EventSession>,
    ) {
        super(repo);
    }
}
