/**
 * Group Conversation Response DTO
 * 
 * 🎯 Purpose: Response structure for group conversation operations
 * 📱 Mobile-First: Optimized response payload
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationResponseDto } from './conversation-response.dto';

export class GroupCreationResponseDto {
    @ApiProperty({
        description: 'Created group conversation details',
        type: ConversationResponseDto
    })
    conversation: ConversationResponseDto;

    @ApiProperty({
        description: 'User IDs that were successfully invited',
        type: [String],
        example: ['user1', 'user2', 'user3']
    })
    invitesSent: string[];

    @ApiPropertyOptional({
        description: 'Initial message sent when creating group',
        example: {
            id: 'msg_123',
            content: 'Welcome to our project team!',
            senderId: 'user_creator',
            createdAt: '2024-01-15T10:30:00Z'
        }
    })
    initialMessage?: {
        id: string;
        content: string;
        senderId: string;
        createdAt: string;
    };
}

export class ConversationListResponseDto {
    @ApiProperty({
        description: 'List of user conversations',
        type: [ConversationResponseDto]
    })
    conversations: ConversationResponseDto[];

    @ApiProperty({
        description: 'Total number of conversations matching criteria',
        example: 150
    })
    total: number;

    @ApiProperty({
        description: 'Whether there are more conversations to load',
        example: true
    })
    hasMore: boolean;

    @ApiPropertyOptional({
        description: 'Next offset for pagination',
        example: 20
    })
    nextOffset?: number;

    @ApiProperty({
        description: 'Request metadata',
        example: {
            requestedAt: '2024-01-15T10:30:00Z',
            responseTime: 45
        }
    })
    meta: {
        requestedAt: string;
        responseTime: number;
    };
}

export class DeleteConversationResponseDto {
    @ApiProperty({
        description: 'Whether deletion was successful',
        example: true
    })
    success: boolean;

    @ApiProperty({
        description: 'Deletion timestamp',
        example: '2024-01-15T10:30:00Z'
    })
    deletedAt: string;

    @ApiPropertyOptional({
        description: 'Number of participants notified',
        example: 5
    })
    participantsNotified?: number;
}
