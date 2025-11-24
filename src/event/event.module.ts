import { forwardRef, Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TrainerModule } from './trainer/trainer.module';
import { ParticipantModule } from './participant/participant.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from 'src/document/document.module';
import { EventDateModule } from './event_date/event_date.module';
import { EventSessionModule } from './event_session/event_session.module';
import { EventDAL } from './dal/event.dal';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { AwsS3Module } from 'src/common/aws-s3/aws-s3.module';
import { EmailModule } from 'src/common/notification/email.module';
import { SessionParticipantMap } from './participant/entities/sessionParticipantMap.entity';
import { ZoneModule } from './adress/zone.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, SessionParticipantMap]),
    forwardRef(() => EventDateModule),
    forwardRef(() => EventSessionModule),
    forwardRef(() => DocumentModule),
    forwardRef(() => TrainerModule),
    forwardRef(() => AwsS3Module),
    TrainerModule,
    ZoneModule,

   
    forwardRef(() => ParticipantModule),
    ActivityModule,
    DocumentModule,
    EmailModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventDAL],
  exports: [EventService,TypeOrmModule],
})
export class EventModule { }
