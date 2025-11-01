import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { ActivityModule } from './activity/activity.module';
import { DocumentModule } from './document/document.module';
import { ParticipantModule } from './participant/participant.module';
import { ScheduleModule } from './schedule/schedule.module';
import { TrainerModule } from './trainer/trainer.module';

@Module({
  imports: [ActivityModule, DocumentModule,ParticipantModule,ScheduleModule,TrainerModule], 
  controllers: [EventController],
  providers: [EventService],
})
export class EventModule {}
