import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { TrainerService } from './trainer.service';
import { TrainerController } from './trainer.controller';
import { TrainerDAL } from './dal/trainer.dal';
import { Trainer } from './entities/trainer.entity'; 
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trainer]), 
  ],
  controllers: [TrainerController],
  providers: [TrainerService, TrainerDAL,AwsS3Service],
  exports: [TrainerService, TrainerDAL,AwsS3Service], 
})
export class TrainerModule {}
