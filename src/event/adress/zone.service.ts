import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from './entities/zone.entity';
import { Woreda } from './entities/woreda.entity';

@Injectable()
export class ZoneService {
  constructor(
    @InjectRepository(Zone)
    private zoneRepository: Repository<Zone>,
    @InjectRepository(Woreda)
    private woredaRepository: Repository<Woreda>,
  ) {}

  async createZone(name: string) {
    const zone = this.zoneRepository.create({ name });
    return this.zoneRepository.save(zone);
  }

  async createMultipleWoredas(zoneId: string, woredas: string[]) {
    const zone = await this.zoneRepository.findOne({ where: { id: zoneId } });
    if (!zone) throw new Error('Zone not found');

    const woredaEntities = woredas.map(name =>
      this.woredaRepository.create({ name, zone }),
    );

    return this.woredaRepository.save(woredaEntities);
  }

  async getZones() {
    return this.zoneRepository.find();
  }

  async getWoredasByZone(zoneId: string) {
    return this.woredaRepository.find({
      where: { zone: { id: zoneId } },
    });
  }

  async getZonesWithWoredas(): Promise<{ name: string; woredas: string[] }[]> {
  const zones = await this.zoneRepository.find({ relations: ['woredas'] });
  return zones.map(z => ({ name: z.name, woredas: z.woredas.map(w => w.name) }));
}
}
