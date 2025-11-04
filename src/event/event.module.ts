import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { TrainerModule } from './trainer/trainer.module';
import { ParticipantModule } from './participant/participant.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from './document/document.module';
import { EventDate } from 'src/event_date/entities/event_date.entity';
import { EventSession } from 'src/event_session/entities/event_session.entity';

@Module({
  imports: [
    EventDate,
    EventSession,
    TrainerModule,
    ParticipantModule,
    ActivityModule,
    DocumentModule,
  ],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule { }
