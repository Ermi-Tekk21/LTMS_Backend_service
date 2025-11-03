import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from './base/base.dal';
import { EventSession } from 'src/event/schedule/entities/EventSession.entity';

@Injectable()
export class EventSessionDAL extends BaseDAL<EventSession> {
    constructor(
        @InjectRepository(EventSession)
        repo: Repository<EventSession>,
    ) {
        super(repo);
    }
}
