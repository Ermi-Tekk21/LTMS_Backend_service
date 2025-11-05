import { Module } from '@nestjs/common';
import { EventDateService } from './event_date.service';
import { EventDateController } from './event_date.controller';
import { EventDateDal } from './dal/event_date.dal';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventDate } from './entities/event_date.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventDate])],
  controllers: [EventDateController],
  providers: [EventDateService, EventDateDal],
  exports: [EventDateService],
})
export class EventDateModule {}
