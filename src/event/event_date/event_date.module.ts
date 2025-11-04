import { Module } from '@nestjs/common';
import { EventDateService } from './event_date.service';
import { EventDateController } from './event_date.controller';

@Module({
  controllers: [EventDateController],
  providers: [EventDateService],
})
export class EventDateModule {}
