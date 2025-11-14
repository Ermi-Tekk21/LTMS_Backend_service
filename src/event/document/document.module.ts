import { forwardRef, Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { DocumentDAL } from './dal/document.dal';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { AwsS3Module } from 'src/common/aws-s3/aws-s3.module';
import { EventModule } from '../event.module';
import { EventService } from '../event.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Event]),
    forwardRef(() => AwsS3Module),
    forwardRef(() => EventModule),

  ],
  controllers: [DocumentController],
  providers: [DocumentService, DocumentDAL],
  exports: [DocumentService],
})
export class DocumentModule { }
