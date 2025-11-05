import { forwardRef, Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TrainerModule } from './trainer/trainer.module';
import { ParticipantModule } from './participant/participant.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from './document/document.module';
import { EventDateModule } from './event_date/event_date.module';
import { EventSessionModule } from './event_session/event_session.module';
import { EventDAL } from './dal/event.dal';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { AwsS3Module } from 'src/common/aws-s3/aws-s3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    forwardRef(() => EventDateModule),
    forwardRef(() => EventSessionModule),
    forwardRef(() => DocumentModule),
    forwardRef(() => AwsS3Module),
    TrainerModule,
    ParticipantModule,
    ActivityModule,
    DocumentModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventDAL],
})
export class EventModule { }
