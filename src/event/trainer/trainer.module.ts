import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { TrainerService } from './trainer.service';
import { TrainerController } from './trainer.controller';
import { TrainerDAL } from './dal/trainer.dal';
import { Trainer } from './entities/trainer.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Trainer]), 
  ],
  controllers: [TrainerController],
  providers: [TrainerService, TrainerDAL],
  exports: [TrainerService, TrainerDAL], 
})
export class TrainerModule {}
