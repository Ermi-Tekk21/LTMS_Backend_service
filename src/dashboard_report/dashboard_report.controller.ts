import { Controller, Get, Query, Req } from '@nestjs/common';
import type { UUID } from 'crypto';
import { DashboardReportService } from './dashboard_report.service';

@Controller('dashboard-report')
export class DashboardReportController {
  constructor(private readonly dashboardReportService: DashboardReportService) {}

  @Get('participant-stats')
  async loadParticipantStats(
    @Query('eventId') eventId?: UUID,
    @Query('period') period?: 'week' | 'month' | 'year',
    @Req() req?: any
  ) {
    const authHeader = req.headers['authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
    return this.dashboardReportService.loadParticipantStats(eventId, period, token);
  }

  @Get('event-stats')
  async eventStats(@Query('period') period?: 'week' | 'month' | 'year') {
    return this.dashboardReportService.eventStats(period);
  }
}
