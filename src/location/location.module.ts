import { Module } from '@nestjs/common';
import { LocationService } from './location.service';

@Module({
  providers: [LocationService],
  exports: [LocationService], // export if other modules need it
})
export class LocationModule {}
