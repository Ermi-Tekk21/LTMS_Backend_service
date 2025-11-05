import { Module } from '@nestjs/common';
import { EventSessionService } from './event_session.service';
import { EventSessionController } from './event_session.controller';
import { EventSessionDal } from './dal/event_session.dal';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSession } from './entities/event_session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventSession])],
  controllers: [EventSessionController],
  providers: [EventSessionService, EventSessionDal],
  exports: [EventSessionService],
})
export class EventSessionModule {}
