import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from '../../../common/dal/base.dal';
import { Activity } from 'src/event/activity/entities/activity.entity';

@Injectable()
export class ActivityDAL extends BaseDAL<Activity> {
    constructor(
        @InjectRepository(Activity)
        repo: Repository<Activity>,
    ) {
        super(repo);
    }
}
