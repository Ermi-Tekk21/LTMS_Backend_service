import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { ScheduleModule } from './schedule/schedule.module';
import { TrainerModule } from './trainer/trainer.module';
import { ParticipantModule } from './participant/participant.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from './document/document.module';

@Module({
  imports: [
    ScheduleModule,
    TrainerModule,
    ParticipantModule,
    ActivityModule,
    DocumentModule,
  ],
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule { }
