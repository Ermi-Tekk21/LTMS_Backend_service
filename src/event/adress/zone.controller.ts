import {
  Controller,
  Get,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { ZoneService } from './zone.service';

@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  @Post()
  createZone(@Body('name') name: string) {
    return this.zoneService.createZone(name);
  }

  @Post('/:zoneId')
  createWoredas(
    @Param('zoneId') zoneId: string,
    @Body('woredas') woredas: string[], // array of names
  ) {
    return this.zoneService.createMultipleWoredas(zoneId, woredas);
  }
  
  @Get()
  getZones() {
    return this.zoneService.getZones();
  }

  @Get(':woredas/:id')
  getWoredas(@Param('zoneId') zoneId: string) {
    return this.zoneService.getWoredasByZone(zoneId);
  }

  
}
