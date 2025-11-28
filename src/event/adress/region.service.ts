import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Region } from './entities/region.entity';

@Injectable()
export class RegionService {
  constructor(
    @InjectRepository(Region)
    private readonly regionRepository: Repository<Region>,
  ) {}

  async createRegion(name: string) {
    const region = this.regionRepository.create({ name });
    return this.regionRepository.save(region);
  }

  async getRegions() {
    return this.regionRepository.find();
  }
}
