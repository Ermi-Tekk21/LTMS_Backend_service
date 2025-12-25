import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from 'src/common/dal/base.dal';
import { Trainer } from 'src/event/trainer/entities/trainer.entity';

@Injectable()
export class TrainerDAL extends BaseDAL<Trainer> {
    constructor(
        @InjectRepository(Trainer)
        repo: Repository<Trainer>,
    ) {
        super(repo);
    }
}
