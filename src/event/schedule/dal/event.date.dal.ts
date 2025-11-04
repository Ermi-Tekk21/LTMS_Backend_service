import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from '../../../common/dal/base.dal';
import { EventDate } from 'src/event/schedule/entities/EventDate.entity';

@Injectable()
export class EventDateDAL extends BaseDAL<EventDate> {
    constructor(
        @InjectRepository(EventDate)
        repo: Repository<EventDate>,
    ) {
        super(repo);
    }
}
