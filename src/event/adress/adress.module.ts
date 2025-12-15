import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Region } from './entities/region.entity';
import { Zone } from './entities/zone.entity';
import { Woreda } from './entities/woreda.entity';

import { RegionZoneWoredaController } from './location.controller';

import { RegionService } from './region.service';
import { ZoneService } from './zoneWoreda.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Region, Zone, Woreda]),
  ],
  controllers: [RegionZoneWoredaController],
  providers: [RegionService, ZoneService],
  exports: [RegionService, ZoneService],
})
export class AdressModule {}
