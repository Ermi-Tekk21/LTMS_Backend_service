import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from '../../common/dal/base.dal';
import { EventDate } from '../entities/event_date.entity';

@Injectable()
export class EventDateDal extends BaseDAL<EventDate> {
    constructor(
        @InjectRepository(EventDate)
        repo: Repository<EventDate>,
    ) {
        super(repo);
    }
}
