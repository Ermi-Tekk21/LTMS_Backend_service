import { Module } from '@nestjs/common';
import { LocationService } from './location.service';
import { LocationController } from './location.controller';

@Module({
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService], // export if other modules need it
})
export class LocationModule {}
