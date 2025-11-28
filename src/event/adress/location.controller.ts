import { Controller, Post, Get, Body, Param, NotFoundException } from '@nestjs/common';
import { ZoneService } from './zoneWoreda.service';
import { RegionService } from './region.service';

@Controller('locations')
export class RegionZoneWoredaController {
  constructor(private readonly zoneService: ZoneService,private readonly regionService: RegionService) {}

  @Post('region')
  async createRegion(@Body('name') name: string) {
    return this.regionService.createRegion(name);
  }

  @Get('region')
  async getRegions() {
    return this.regionService.getRegions();
  }

  @Post('region/:regionId/zone')
  async createZone(
    @Param('regionId') regionId: string,
    @Body('name') name: string,
  ) {
    return this.zoneService.createZone(regionId, name);
  }

  @Get('region/:regionId/zones')
  async getZonesByRegion(@Param('regionId') regionId: string) {
    return this.zoneService.getZonesByRegion(regionId);
  }

  // @Get('zones')
  // async getAllZones() {
  //   return this.zoneService.getAllZones();
  // }

  @Post('zone/:zoneId/woredas')
  async createMultipleWoredas(
    @Param('zoneId') zoneId: string,
    @Body('woredas') woredas: string[],
  ) {
    return this.zoneService.createMultipleWoredas(zoneId, woredas);
  }

  @Get('zone/:zoneId/woredas')
  async getWoredasByZone(@Param('zoneId') zoneId: string) {
    return this.zoneService.getWoredasByZone(zoneId);
  }

  // @Get('zones/woredas')
  // async getZonesWithWoredas() {
  //   return this.zoneService.getZonesWithWoredas();
  // }

  @Get('regions-zones-woredas')
  async getALlRegionsWithZonesAndWoredas() {
    return this.zoneService.getALlRegionsWithZonesAndWoredas();
  }
}