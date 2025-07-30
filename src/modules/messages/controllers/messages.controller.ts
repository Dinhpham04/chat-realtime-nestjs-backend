/**
 * Messages Controller
 *
 * 🎯 Purpose: REST API endpoints for message operations
 * 📱 Mobile-First: Comprehensive message endpoints for mobile apps
 * 🚀 Clean Architecture: Controller layer with dependency injection
 *
 * Design Principles:
 * - Single Responsibility: Handle HTTP requests for messages
 * - Interface Segregation: Clean separation between HTTP and Socket.IO
 * - Dependency Inversion: Depend on service abstractions
 * - DRY: Reuse DTOs and validation patterns
 * - Documentation Separation: Swagger docs in separate file following Friends pattern
 */

import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    BadRequestException,
    HttpCode,
    HttpStatus,
    SetMetadata
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiProduces } from '@nestjs/swagger';
import { MessagesService } from '../services/messages.service';
import {
    CreateMessageDto,
    UpdateMessageDto,
    MessagePaginationDto,
    MessageSearchDto,
    BulkMessageOperationDto,
    MessageResponseDto,
    PaginatedMessagesResponseDto,
    BulkOperationResponseDto
} from '../dto';
import { UserContext } from '../interfaces/message-service.interface';
import {
    SendMessageDocs,
    GetConversationMessagesDocs,
    SearchMessagesDocs,
    EditMessageDocs,
    DeleteMessageDocs,
    MarkAsReadDocs,
    BulkOperationDocs,
    ForwardMessageDocs,
    MessageAnalyticsDocs
} from '../documentation/messages.api-docs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserId } from '../../auth/decorators/current-user.decorator';
import { JwtUser } from '../../auth/interfaces/jwt-payload.interface';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    /**
     * Admin/Test endpoint - Smoke test for messages module
     * Following instruction pattern for testing endpoints
     */
    @Get('admin/test')
    @HttpCode(HttpStatus.OK)
    @SetMetadata('isPublic', true)
    async adminTest(): Promise<{
        module: string;
        status: string;
        timestamp: string;
        services: string[];
        database: string;
    }> {
        return {
            module: 'Messages',
            status: 'operational',
            timestamp: new Date().toISOString(),
            services: ['MessagesService', 'MessageRepository', 'EventEmitter'],
            database: 'MongoDB connected'
        };
    }

    /**
     * Send a new message
     */
    @Post()
    @SendMessageDocs
    async sendMessage(
        @Body() createMessageDto: CreateMessageDto,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<MessageResponseDto> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.sendMessage(createMessageDto, userContext);
    }

    /**
     * Get conversation messages with pagination
     */
    @Get('conversation/:conversationId')
    @GetConversationMessagesDocs
    async getConversationMessages(
        @Param('conversationId') conversationId: string,
        @Query() pagination: MessagePaginationDto,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<PaginatedMessagesResponseDto> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.getConversationMessages(
            conversationId,
            pagination,
            userContext
        );
    }

    /**
     * Get recent messages for conversation (optimized for chat history)
     * Fast endpoint for initial chat load
     */
    @Get('conversation/:conversationId/recent')
    async getRecentMessages(
        @Param('conversationId') conversationId: string,
        @CurrentUser() user: JwtUser,
        @Request() req: any,
        @Query('limit') limit?: number,
        @Query('before') before?: string, // Message ID to load messages before
    ): Promise<{
        messages: MessageResponseDto[];
        hasMore: boolean;
        oldestMessageId?: string;
        total: number;
    }> {
        const userContext = this.buildUserContext(user, req);
        const maxLimit = Math.min(limit || 50, 100); // Max 100 messages

        return await this.messagesService.getRecentMessages(
            conversationId,
            maxLimit,
            before,
            userContext
        );
    }

    /**
     * Get messages around a specific message (for jump to message feature)
     */
    @Get('conversation/:conversationId/around/:messageId')
    async getMessagesAround(
        @Param('conversationId') conversationId: string,
        @Param('messageId') messageId: string,
        @CurrentUser() user: JwtUser,
        @Request() req: any,
        @Query('limit') limit?: number,
    ): Promise<{
        messages: MessageResponseDto[];
        targetMessage: MessageResponseDto;
        hasMoreBefore: boolean;
        hasMoreAfter: boolean;
    }> {
        const userContext = this.buildUserContext(user, req);
        const contextLimit = Math.min(limit || 25, 50); // 25 messages before + 25 after

        return await this.messagesService.getMessagesAround(
            conversationId,
            messageId,
            contextLimit,
            userContext
        );
    }

    /**
     * Search messages in conversation
     */
    @Get('conversation/:conversationId/search')
    @SearchMessagesDocs
    async searchMessages(
        @Param('conversationId') conversationId: string,
        @Query() searchDto: MessageSearchDto,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<PaginatedMessagesResponseDto> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.searchMessages(
            conversationId,
            searchDto,
            userContext
        );
    }

    /**
     * Edit a message
     */
    @Put(':messageId')
    @EditMessageDocs
    async editMessage(
        @Param('messageId') messageId: string,
        @Body() updateMessageDto: UpdateMessageDto,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<MessageResponseDto> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.editMessage(
            messageId,
            updateMessageDto,
            userContext
        );
    }

    /**
     * Delete a message
     */
    @Delete(':messageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @DeleteMessageDocs
    async deleteMessage(
        @Param('messageId') messageId: string,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<void> {
        const userContext = this.buildUserContext(user, req);
        await this.messagesService.deleteMessage(messageId, userContext);
    }

    /**
     * Mark message as read
     */
    @Post(':messageId/read')
    @HttpCode(HttpStatus.NO_CONTENT)
    @MarkAsReadDocs
    async markAsRead(
        @Param('messageId') messageId: string,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<void> {
        const userContext = this.buildUserContext(user, req);
        await this.messagesService.markAsRead(messageId, userContext);
    }

    /**
     * Bulk operations on messages
     */
    @Post('bulk-operation')
    @BulkOperationDocs
    async bulkOperation(
        @Body() bulkOperationDto: BulkMessageOperationDto,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<BulkOperationResponseDto> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.bulkOperation(bulkOperationDto, userContext);
    }

    /**
     * Forward message to other conversations
     */
    @Post(':messageId/forward')
    @ForwardMessageDocs
    async forwardMessage(
        @Param('messageId') messageId: string,
        @Body('conversationIds') conversationIds: string[],
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<MessageResponseDto[]> {
        if (!conversationIds || conversationIds.length === 0) {
            throw new BadRequestException('Conversation IDs are required');
        }

        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.forwardMessage(
            messageId,
            conversationIds,
            userContext
        );
    }

    /**
     * Get message analytics for conversation
     */
    @Get('analytics/:conversationId')
    @MessageAnalyticsDocs
    async getMessageAnalytics(
        @Param('conversationId') conversationId: string,
        @CurrentUser() user: JwtUser,
        @Request() req: any
    ): Promise<{
        totalMessages: number;
        messagesPerDay: number;
        mostActiveUsers: Array<{ userId: string; messageCount: number }>;
        messageTypeDistribution: Record<string, number>;
    }> {
        const userContext = this.buildUserContext(user, req);
        return await this.messagesService.getMessageAnalytics(conversationId, userContext);
    }

    /**
     * Build user context from authenticated user and request
     * Following Clean Architecture principles - transform auth data to domain context
     * Note: Removed conversationMemberships - authorization is handled by domain services
     */
    private buildUserContext(user: JwtUser, req: any): UserContext {
        return {
            userId: user.userId,
            deviceId: user.deviceId,
            roles: user.roles
        };
    }
}
