import { forwardRef, Module } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { Participant } from './entities/participant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../event.module';
import { ParticipantDAL } from './dal/participant.dal';
import { LocationModule } from '../adress/zone.module';
import { ParticipantSessionMapDal } from './dal/participant_session_map.dal';

@Module({
  imports: [
    TypeOrmModule.forFeature([Participant]),
    forwardRef(() => EventModule),
    LocationModule,
  ],
  controllers: [ParticipantController],
  providers: [ParticipantService, ParticipantDAL, ParticipantSessionMapDal],
})
export class ParticipantModule { }

