import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDAL } from './base/base.dal';
import { Document } from 'src/event/document/entities/document.entity';

@Injectable()
export class DocumentDAL extends BaseDAL<Document> {
    constructor(
        @InjectRepository(Document)
        repo: Repository<Document>,
    ) {
        super(repo);
    }
}
