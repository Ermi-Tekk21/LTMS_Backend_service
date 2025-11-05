import { Module } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { Participant } from './entities/participant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';

@Module({
  imports: [TypeOrmModule.forFeature([Participant])],
  controllers: [ParticipantController],
  providers: [ParticipantService, ParticipantDAL],
})
export class ParticipantModule {}
