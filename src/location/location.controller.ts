import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('tree')
  async getLocationTree(@Req() req: Request) {
    const reqAny = req as any;
    const authHeader: string | undefined =
      reqAny?.headers?.authorization ?? reqAny?.headers?.Authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;

    if (!token) {
      throw new Error('Authorization token missing');
    }

    console.log('extracted token:', token);

    return await this.locationService.getLocationTree(token);
  }
}
