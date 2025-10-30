import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './shared/database/db_connector';
import { ScheduleModule } from './event/schedule/schedule.module';
import { TrainerModule } from './event/trainer/trainer.module';
import { ParticipantModule } from './event/participant/participant.module';
import { ActivityModule } from './event/activity/activity.module';
import { DocumentModule } from './event/document/document.module';
import { AuditLogModule } from './shared/audit_log/audit_log.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    EventModule,
    ScheduleModule,
    TrainerModule,
    ParticipantModule,
    ActivityModule,
    DocumentModule,
    AuditLogModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
