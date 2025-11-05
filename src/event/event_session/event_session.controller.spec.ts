import { Test, TestingModule } from '@nestjs/testing';
import { EventSessionController } from './event_session.controller';
import { EventSessionService } from './event_session.service';

describe('EventSessionController', () => {
  let controller: EventSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventSessionController],
      providers: [EventSessionService],
    }).compile();

    controller = module.get<EventSessionController>(EventSessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
