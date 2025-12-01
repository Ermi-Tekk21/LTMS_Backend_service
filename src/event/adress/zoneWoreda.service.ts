import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from './entities/zone.entity';
import { Woreda } from './entities/woreda.entity';
import { Region } from './entities/region.entity';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(Zone)
    private readonly zoneRepository: Repository<Zone>,

    @InjectRepository(Woreda)
    private readonly woredaRepository: Repository<Woreda>,

    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
  ) {}

  async createZone(regionId: string, name: string) {
    const region = await this.regionRepository.findOne({ where: { id: regionId } });
    if (!region) throw new NotFoundException('Region not found');

    const zone = this.zoneRepository.create({ name, region });
    return this.zoneRepository.save(zone);
  }

  async createMultipleWoredas(zoneId: string, woredas: string[]) {
    const zone = await this.zoneRepository.findOne({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('Zone not found');

    const entities = woredas.map(w =>
      this.woredaRepository.create({ name: w, zone }),
    );
    return this.woredaRepository.save(entities);
  }

  async getZonesByRegion(regionId: string) {
    return this.zoneRepository.find({
      where: { region: { id: regionId } },
    });
  }

  async getWoredasByZone(zoneId: string) {
    return this.woredaRepository.find({
      where: { zone: { id: zoneId } },
    });
  }

  async getRegionsWithZonesAndWoredas() {
  const regions = await this.regionRepository.find({
    relations: ['zones', 'zones.woredas'],
  });

  return regions.map(r => ({
    region: r.name,
    zones: r.zones.map(z => ({
      zone: z.name,
      
      woredas: z.woredas.map(w => w.name),
    })),
  }));
}

 async getALlRegionsWithZonesAndWoredas() {
  const regions = await this.regionRepository.find({
    relations: ['zones', 'zones.woredas'],
  });
return regions
 }
}
