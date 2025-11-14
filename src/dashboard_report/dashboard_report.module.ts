import { Module } from '@nestjs/common';
import { DashboardReportService } from './dashboard_report.service';
import { DashboardReportController } from './dashboard_report.controller';
import { Participant } from 'src/event/participant/entities/participant.entity';
import { Document } from 'src/event/document/entities/document.entity';
import { Trainer } from 'src/event/trainer/entities/trainer.entity';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { EventDAL } from 'src/event/dal/event.dal';

@Module({
    imports: [Participant, Trainer, Event, Document],
    providers: [DashboardReportService, ParticipantDAL, EventDAL],
    controllers: [DashboardReportController]
})
export class DashboardReportModule { }
