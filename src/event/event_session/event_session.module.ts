import { Module } from '@nestjs/common';
import { EventSessionService } from './event_session.service';
import { EventSessionController } from './event_session.controller';

@Module({
  controllers: [EventSessionController],
  providers: [EventSessionService],
})
export class EventSessionModule {}
