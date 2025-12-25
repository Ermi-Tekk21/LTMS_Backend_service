import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardReportService } from './dashboard_report.service';
import { DashboardReportController } from './dashboard_report.controller';
import { Participant } from 'src/event/participant/entities/participant.entity';
import { Document } from 'src/document/entities/document.entity';
import { Trainer } from 'src/event/trainer/entities/trainer.entity';
import { Event } from 'src/event/entities/event.entity';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { EventDAL } from 'src/event/dal/event.dal';
import { ParticipantSessionMapDal } from 'src/event/participant/dal/participant_session_map.dal';
import { SessionParticipantMap } from 'src/event/participant/entities/sessionParticipantMap.entity';
import { EventDateDal } from 'src/event/event_date/dal/event_date.dal';
import { EventDate } from 'src/event/event_date/entities/event_date.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Participant, Trainer, Event, Document, SessionParticipantMap, EventDate])],
    providers: [DashboardReportService, ParticipantDAL, EventDAL, ParticipantSessionMapDal, EventDateDal],
    controllers: [DashboardReportController]
})
export class DashboardReportModule { }
