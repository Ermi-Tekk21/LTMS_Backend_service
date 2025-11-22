import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from 'src/common/dal/base.dal';
import { Document } from '../entities/document.entity';

@Injectable()
export class DocumentDAL extends BaseDAL<Document> {
    constructor(
        @InjectRepository(Document)
        repo: Repository<Document>,
    ) {
        super(repo);
    }
}
