import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from './base/base.dal';
import { Event } from 'src/event/entities/event.entity';

@Injectable()
export class EventDAL extends BaseDAL<Event> {
    constructor(
        @InjectRepository(Event)
        repo: Repository<Event>,
    ) {
        super(repo);
    }
}
