

import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from '../services/conversations.service';

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            prepareDirectConversation: jest.fn(),
            activateConversation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have prepareDirectConversation method', () => {
    expect(service.prepareDirectConversation).toBeDefined();
  });

  it('should have activateConversation method', () => {
    expect(service.activateConversation).toBeDefined();
  });
});
