import { Module } from '@nestjs/common';
import { EventModule } from './event/event.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ParticipantModule } from './participant/participant.module';
import { TrainerModule } from './trainer/trainer.module';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from './document/document.module';

@Module({
  controllers: [],
  providers: [],
  imports: [EventModule, ScheduleModule, ParticipantModule, TrainerModule, ActivityModule, DocumentModule],
})
export class TrainingEventModule {}
