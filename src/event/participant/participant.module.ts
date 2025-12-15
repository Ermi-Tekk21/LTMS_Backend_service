import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { Participant } from './entities/participant.entity';
import { ParticipantDAL } from './dal/participant.dal';
import { ParticipantSessionMapDal } from './dal/participant_session_map.dal';
// import { EventModule } from '../event/event.module';
import { LocationModule } from 'src/location/location.module';
import { EventModule } from '../event.module';
import { AdressModule } from '../adress/adress.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Participant]),
    forwardRef(() => EventModule),
    LocationModule, 
     AdressModule,
  ],
  controllers: [ParticipantController],
  providers: [
    ParticipantService,
    ParticipantDAL,
    ParticipantSessionMapDal,
  ],
  exports: [ParticipantService], // optional if other modules need it
})
export class ParticipantModule {}
