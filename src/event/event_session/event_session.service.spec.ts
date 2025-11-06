import { Test, TestingModule } from '@nestjs/testing';
import { EventSessionService } from './event_session.service';

describe('EventSessionService', () => {
  let service: EventSessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventSessionService],
    }).compile();

    service = module.get<EventSessionService>(EventSessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
