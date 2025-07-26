/**
 * API Documentation for Group Conversation Endpoints
 * 
 * 🎯 Purpose: Swagger/OpenAPI documentation for group conversation operations
 * 📚 Usage: Provides complete API documentation with examples
 */

import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiQuery,
    ApiParam,
    ApiBadRequestResponse,
    ApiNotFoundResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse
} from '@nestjs/swagger';
import {
    CreateGroupConversationDto,
    UpdateConversationMetadataDto,
    GetUserConversationsQueryDto
} from '../dto';
import {
    GroupCreationResponseDto,
    ConversationListResponseDto,
    DeleteConversationResponseDto
} from '../dto/response/group-conversation-response.dto';
import { ConversationResponseDto } from '../dto/response/conversation-response.dto';

/**
 * Create Group Conversation API Documentation
 */
export function CreateGroupConversationApiDocs() {
    return applyDecorators(
        ApiOperation({
            summary: 'Create Group Conversation',
            description: `
        Create a new group conversation with multiple participants.
        
        **Business Rules:**
        - Minimum 3 participants (creator + 2 others)
        - Maximum 1000 participants
        - Creator becomes admin automatically
        - All participants must be valid users
        - Group name is required (1-100 characters)
        
        **Mobile UX:**
        - Call when user creates group from contact selection
        - Show loading state during creation
        - Handle participant validation errors
        - Send initial message if provided
      `,
            tags: ['Conversations']
        }),
        ApiBody({
            type: CreateGroupConversationDto,
            description: 'Group creation data',
            examples: {
                basic: {
                    summary: 'Basic group creation',
                    value: {
                        name: 'Project Team Alpha',
                        description: 'Discussion for Project Alpha development',
                        participantIds: ['user1', 'user2', 'user3'],
                        settings: {
                            allowMembersToAdd: true,
                            allowAllToSend: true,
                            muteNotifications: false,
                            disappearingMessages: 0
                        }
                    }
                },
                withInitialMessage: {
                    summary: 'Group with welcome message',
                    value: {
                        name: 'Family Chat',
                        participantIds: ['mom', 'dad', 'sister'],
                        avatarUrl: 'https://example.com/group-avatar.jpg',
                        initialMessage: 'Welcome to our family group chat! 🎉'
                    }
                }
            }
        }),
        ApiResponse({
            status: 201,
            description: 'Group conversation created successfully',
            type: GroupCreationResponseDto,
            example: {
                conversation: {
                    id: 'conv_abc123',
                    type: 'group',
                    name: 'Project Team Alpha',
                    description: 'Discussion for Project Alpha development',
                    participants: [
                        {
                            userId: 'creator123',
                            role: 'admin',
                            joinedAt: '2024-01-15T10:30:00Z',
                            user: {
                                id: 'creator123',
                                username: 'john_doe',
                                fullName: 'John Doe',
                                avatarUrl: 'https://example.com/john.jpg',
                                isOnline: true
                            }
                        }
                    ],
                    createdBy: 'creator123',
                    createdAt: '2024-01-15T10:30:00Z',
                    updatedAt: '2024-01-15T10:30:00Z',
                    isActive: true,
                    unreadCount: 0
                },
                invitesSent: ['user1', 'user2', 'user3'],
                initialMessage: {
                    id: 'msg_xyz789',
                    content: 'Welcome to our project team!',
                    senderId: 'creator123',
                    createdAt: '2024-01-15T10:30:05Z'
                }
            }
        }),
        ApiBadRequestResponse({
            description: 'Invalid group data or participants',
            example: {
                statusCode: 400,
                message: [
                    'Group must have at least 2 other participants',
                    'Invalid participant IDs: user999',
                    'Group name cannot exceed 100 characters'
                ],
                error: 'Bad Request'
            }
        }),
        ApiNotFoundResponse({
            description: 'One or more participants not found',
            example: {
                statusCode: 404,
                message: 'Invalid participant IDs: user1, user2',
                error: 'Not Found'
            }
        }),
        ApiUnauthorizedResponse({
            description: 'User not authenticated'
        })
    );
}

/**
 * Get User Conversations API Documentation
 */
export function GetUserConversationsApiDocs() {
    return applyDecorators(
        ApiOperation({
            summary: 'Get User Conversations',
            description: `
        Get paginated list of user's conversations with filtering and sorting.
      `,
            tags: ['Conversations']
        }),
        ApiQuery({
            type: GetUserConversationsQueryDto,
            required: false,
            description: 'Query filters and pagination'
        }),
        ApiResponse({
            status: 200,
            description: 'User conversations retrieved successfully',
            type: ConversationListResponseDto,
            example: {
                conversations: [
                    {
                        id: 'conv_abc123',
                        type: 'group',
                        name: 'Project Team Alpha',
                        avatarUrl: 'https://example.com/group.jpg',
                        participantCount: 5,
                        lastMessage: {
                            id: 'msg_last123',
                            content: 'Great work everyone!',
                            messageType: 'text',
                            senderId: 'user123',
                            createdAt: '2024-01-15T15:30:00Z'
                        },
                        unreadCount: 3,
                        lastActivity: '2024-01-15T15:30:00Z',
                        isArchived: false,
                        isPinned: true,
                        isMuted: false
                    }
                ],
                total: 25,
                hasMore: true,
                nextOffset: 20,
                meta: {
                    requestedAt: '2024-01-15T16:00:00Z',
                    responseTime: 45
                }
            }
        }),
        ApiBadRequestResponse({
            description: 'Invalid query parameters',
            example: {
                statusCode: 400,
                message: ['limit must not be greater than 100'],
                error: 'Bad Request'
            }
        }),
        ApiUnauthorizedResponse({
            description: 'User not authenticated'
        })
    );
}

/**
 * Update Conversation Metadata API Documentation
 */
export function UpdateConversationMetadataApiDocs() {
    return applyDecorators(
        ApiOperation({
            summary: 'Update Conversation Metadata',
            description: `
        Update group conversation name, description, avatar, and settings.
        
        **Authorization:**
        - Only group admins can update metadata
        - Direct conversations cannot be updated (name/description)
        - Settings can be updated by participants
        
        **Updatable Fields:**
        - name: Group display name (1-100 characters)
        - description: Group description (max 500 characters)
        - avatarUrl: Group avatar image URL
        - settings: Group behavior settings
        
        **Real-time Updates:**
        - Changes are broadcast to all participants
        - WebSocket events notify group members
        - Activity feed shows update history
      `,
            tags: ['Conversations']
        }),
        ApiParam({
            name: 'conversationId',
            description: 'Unique conversation identifier',
            example: 'conv_abc123'
        }),
        ApiBody({
            type: UpdateConversationMetadataDto,
            description: 'Fields to update',
            examples: {
                nameUpdate: {
                    summary: 'Update group name',
                    value: {
                        name: 'New Project Team Name'
                    }
                },
                fullUpdate: {
                    summary: 'Update all metadata',
                    value: {
                        name: 'Updated Team Name',
                        description: 'Updated description for the team',
                        avatarUrl: 'https://example.com/new-avatar.jpg',
                        settings: {
                            allowMembersToAdd: false,
                            allowAllToSend: true,
                            muteNotifications: false,
                            disappearingMessages: 24
                        }
                    }
                }
            }
        }),
        ApiResponse({
            status: 200,
            description: 'Conversation metadata updated successfully',
            type: ConversationResponseDto,
            example: {
                id: 'conv_abc123',
                type: 'group',
                name: 'Updated Team Name',
                description: 'Updated description for the team',
                avatarUrl: 'https://example.com/new-avatar.jpg',
                updatedAt: '2024-01-15T16:45:00Z'
            }
        }),
        ApiBadRequestResponse({
            description: 'Invalid update data or no changes provided',
            example: {
                statusCode: 400,
                message: [
                    'No changes provided',
                    'Group name cannot be empty',
                    'Cannot update name/description for direct conversations'
                ],
                error: 'Bad Request'
            }
        }),
        ApiNotFoundResponse({
            description: 'Conversation not found',
            example: {
                statusCode: 404,
                message: 'Conversation not found',
                error: 'Not Found'
            }
        }),
        ApiForbiddenResponse({
            description: 'User lacks permission to update conversation',
            example: {
                statusCode: 403,
                message: 'Access denied: only admins can update group metadata',
                error: 'Forbidden'
            }
        }),
        ApiUnauthorizedResponse({
            description: 'User not authenticated'
        })
    );
}

/**
 * Delete Conversation API Documentation
 */
export function DeleteConversationApiDocs() {
    return applyDecorators(
        ApiOperation({
            summary: 'Delete Conversation (Groups Only)',
            description: `
        Permanently delete a group conversation. Only group admins can delete.
        
        **Important Notes:**
        - Only group conversations can be deleted
        - Direct conversations cannot be deleted (only archived)
        - This is a soft delete operation (data retained for recovery)
        - All participants are notified of deletion
        - Chat history is preserved but conversation becomes inaccessible
        
        **Admin Requirements:**
        - User must be group admin
        - At least one admin must remain if not deleting
        - Action is logged for audit purposes
        
        **After Deletion:**
        - Conversation disappears from all participants' lists
        - WebSocket notifications sent to all members
        - Messages remain in database for compliance
      `,
            tags: ['Conversations']
        }),
        ApiParam({
            name: 'conversationId',
            description: 'Unique conversation identifier',
            example: 'conv_abc123'
        }),
        ApiResponse({
            status: 200,
            description: 'Conversation deleted successfully',
            type: DeleteConversationResponseDto,
            example: {
                success: true,
                deletedAt: '2024-01-15T17:00:00Z',
                participantsNotified: 4
            }
        }),
        ApiBadRequestResponse({
            description: 'Cannot delete conversation',
            example: {
                statusCode: 400,
                message: [
                    'Only group conversations can be deleted',
                    'Access denied: only group admins can delete conversations'
                ],
                error: 'Bad Request'
            }
        }),
        ApiNotFoundResponse({
            description: 'Conversation not found',
            example: {
                statusCode: 404,
                message: 'Conversation not found',
                error: 'Not Found'
            }
        }),
        ApiForbiddenResponse({
            description: 'User lacks permission to delete conversation',
            example: {
                statusCode: 403,
                message: 'Access denied: only group admins can delete conversations',
                error: 'Forbidden'
            }
        }),
        ApiUnauthorizedResponse({
            description: 'User not authenticated'
        })
    );
}
