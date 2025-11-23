import { Test, TestingModule } from '@nestjs/testing';
import { DashboardReportController } from './dashboard_report.controller';

describe('DashboardReportController', () => {
  let controller: DashboardReportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardReportController],
    }).compile();

    controller = module.get<DashboardReportController>(DashboardReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
