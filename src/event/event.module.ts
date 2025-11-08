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
import { EmailModule } from 'src/common/notification/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    forwardRef(() => EventDateModule),
    forwardRef(() => EventSessionModule),
    TrainerModule,
   
    forwardRef(() => ParticipantModule),
    ActivityModule,
    DocumentModule,
    EmailModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventDAL],
  exports: [EventService],
})
export class EventModule { }
