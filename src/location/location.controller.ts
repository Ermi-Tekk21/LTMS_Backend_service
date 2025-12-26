import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

 @Get('tree')
async getLocationTree(
  @Req() req: Request,
  @Query('region') region?: string,
  @Query('zone') zone?: string,
) {
  const authHeader =
    req.headers.authorization ?? (req.headers as any).Authorization;

  if (!authHeader) {
    throw new UnauthorizedException('Authorization token missing');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  return this.locationService.getLocationTree(token, {
    region,
    zone,
  });
}
}
