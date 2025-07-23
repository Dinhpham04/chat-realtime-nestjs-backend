/**
 * Conversations Controller
 * 
 * 🎯 Purpose: REST API endpoints for conversation management
 * 📱 Mobile-First: Optimized for mobile messaging apps (Zalo/Messenger style)
 * 🚀 Features: Prepare conversation + Activate with first message
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  ValidationPipe,
  UsePipes,
  NotFoundException,
  Inject
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { IConversationsService } from '../services/interfaces/conversations-service.interface';
import {
  PrepareConversationDto,
  ActivateConversationDto,
  PrepareConversationResponseDto,
  ActivateConversationResponseDto,
  ConversationResponseDto
} from '../dto';
import {
  PrepareConversationApiDocs,
  ActivateConversationApiDocs,
  GetConversationApiDocs
} from '../documentation';

@Controller('api/v1/conversations')
@UseGuards(JwtAuthGuard)
@ApiTags('Conversations')
@ApiBearerAuth('JWT-auth')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    @Inject('IConversationsService')
    private readonly conversationsService: IConversationsService,
  ) { }

  /**
   * Prepare Direct Conversation
   * 
   * 🎯 Purpose: Create or get existing conversation when user clicks contact
   * 📱 UX: Instant navigation to chat screen
   * 
   * Flow:
   * 1. User clicks contact in contact list
   * 2. App calls this API to prepare conversation
   * 3. API returns conversation ID + participant info  
   * 4. App navigates to chat screen immediately
   * 5. Conversation is "dormant" until first message
   */
  @Post('/prepare')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @PrepareConversationApiDocs()
  async prepareConversation(
    @CurrentUser() user: any,
    @Body() prepareDto: PrepareConversationDto
  ): Promise<PrepareConversationResponseDto> {
    this.logger.log(
      `Preparing conversation between ${user.id} and ${prepareDto.participantId}`
    );

    const result = await this.conversationsService.prepareDirectConversation(
      user.id,
      prepareDto.participantId
    );

    this.logger.log(
      `Conversation prepared: ${result.conversationId}, exists: ${result.exists}, active: ${result.isActive}`
    );

    return {
      conversationId: result.conversationId,
      exists: result.exists,
      isActive: result.isActive,
      participant: result.participant,
      conversation: result.conversation!
    };
  }

  /**
   * Activate Conversation with First Message
   * 
   * 🎯 Purpose: Send first message and activate dormant conversation
   * 📱 UX: User types and sends first message
   * 
   * Flow:
   * 1. User is in chat screen (from prepare API)
   * 2. User types first message and hits send
   * 3. App calls this API to activate conversation + send message
   * 4. API activates conversation and creates first message
   * 5. Returns full conversation context + message details
   * 6. App updates UI with active conversation
   */
  @Post('/activate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ActivateConversationApiDocs()
  async activateConversation(
    @CurrentUser() user: any,
    @Body() activateDto: ActivateConversationDto
  ): Promise<ActivateConversationResponseDto> {
    this.logger.log(
      `Activating conversation ${activateDto.conversationId} with message from ${user.id}`
    );

    const result = await this.conversationsService.activateConversation(
      activateDto.conversationId,
      user.id,
      activateDto.initialMessage
    );

    this.logger.log(
      `Conversation activated: ${result.conversation.id}, message: ${result.message.id}`
    );

    return {
      conversation: {
        ...result.conversation,
        lastMessage: result.conversation.lastMessage || undefined
      },
      message: result.message,
      created: result.created
    };
  }

  /**
   * Get Conversation Details
   * 
   * 🎯 Purpose: Get full conversation info for active conversations
   * 📱 UX: Load conversation details when entering chat screen
   */
  @Get('/:conversationId')
  @GetConversationApiDocs()
  async getConversation(
    @CurrentUser() user: any,
    @Param('conversationId') conversationId: string
  ): Promise<ConversationResponseDto> {
    this.logger.log(`Getting conversation ${conversationId} for user ${user.id}`);

    const conversation = await this.conversationsService.getConversationById(
      conversationId,
      user.id
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    this.logger.log(`Retrieved conversation: ${conversation.id}`);

    return {
      ...conversation,
      lastMessage: conversation.lastMessage || undefined
    };
  }
}
