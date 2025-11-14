import { Test, TestingModule } from '@nestjs/testing';
import { DashboardReportService } from './dashboard_report.service';

describe('DashboardReportService', () => {
  let service: DashboardReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardReportService],
    }).compile();

    service = module.get<DashboardReportService>(DashboardReportService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
