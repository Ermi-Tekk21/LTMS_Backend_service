import { forwardRef, Module } from '@nestjs/common';
import { ParticipantService } from './participant.service';
import { ParticipantController } from './participant.controller';
import { Participant } from './entities/participant.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../event.module';
import { ParticipantDAL } from './dal/participant.dal';
import { ZoneModule } from '../adress/zone.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Participant]), 
   forwardRef(() => EventModule),
   ZoneModule,
  ],
  controllers: [ParticipantController],
  providers: [ParticipantService,ParticipantDAL],
})
export class ParticipantModule {}

