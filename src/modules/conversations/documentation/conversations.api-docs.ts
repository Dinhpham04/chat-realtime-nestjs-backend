import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import {
  PrepareConversationDto,
  PrepareConversationResponseDto,
  ConversationResponseDto
} from '../dto';

/**
 * Conversations API Documentation
 * 
 * Following instruction-senior.md:
 * - Single Responsibility: Each function documents one endpoint
 * - Clean Architecture: Documentation separated from controller logic  
 * - DRY Principle: Reusable error responses
 * - Domain Separation: Conversations domain documentation in conversations module
 */

// Common error responses for reusability
const commonErrorResponses = {
  badRequest: {
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation errors in request data',
    example: {
      statusCode: 400,
      message: ['Validation error messages'],
      error: 'Bad Request',
      timestamp: '2025-07-22T10:30:00.000Z',
      path: '/api/v1/conversations/*'
    }
  },
  unauthorized: {
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - invalid or missing JWT token',
    example: {
      statusCode: 401,
      message: 'Unauthorized',
      error: 'Unauthorized',
      timestamp: '2025-07-22T10:30:00.000Z',
      path: '/api/v1/conversations/*'
    }
  },
  notFound: {
    status: HttpStatus.NOT_FOUND,
    description: 'Conversation or user not found',
    example: {
      statusCode: 404,
      message: 'Conversation not found',
      error: 'Not Found',
      timestamp: '2025-07-22T10:30:00.000Z',
      path: '/api/v1/conversations/*'
    }
  },
  forbidden: {
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied - user is not a participant',
    example: {
      statusCode: 403,
      message: 'Access denied to this conversation',
      error: 'Forbidden',
      timestamp: '2025-07-22T10:30:00.000Z',
      path: '/api/v1/conversations/*'
    }
  },
  conflict: {
    status: HttpStatus.CONFLICT,
    description: 'Conflict - invalid operation state',
    example: {
      statusCode: 409,
      message: 'Cannot create conversation with yourself',
      error: 'Conflict',
      timestamp: '2025-07-22T10:30:00.000Z',
      path: '/api/v1/conversations/*'
    }
  }
};

/**
 * Prepare Direct Conversation API Documentation
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
export function PrepareConversationApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Prepare direct conversation',
      description: `
            Prepare a direct conversation between current user and another user.
            This endpoint is called when user clicks on a contact to start chatting.
            
            **Use Cases:**
            - User clicks contact in contact list
            - User wants to start new conversation
            - Check if conversation already exists
            
            **Behavior:**
            - If conversation exists: return existing conversation info
            - If conversation doesn't exist: create dormant conversation
            - Dormant conversation becomes active when first message is sent
            
            **Mobile UX Pattern:**
            - Mimics Zalo/Messenger instant navigation
            - No loading screen - immediate chat access
            - Prepare conversation in background while user types
            `
    }),
    ApiBody({
      type: PrepareConversationDto,
      description: 'Participant information to prepare conversation',
      examples: {
        prepare_conversation: {
          summary: 'Prepare conversation with user',
          description: 'Standard request to prepare direct conversation',
          value: {
            participantId: '64f1a2b3c4d5e6f7a8b9c0d1'
          }
        }
      }
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Conversation prepared successfully',
      type: PrepareConversationResponseDto,
      examples: {
        new_conversation: {
          summary: 'New conversation created',
          value: {
            conversationId: '64f2b3c4d5e6f7a8b9c0d2e3',
            exists: false,
            isActive: false,
            participant: {
              id: '64f1a2b3c4d5e6f7a8b9c0d1',
              username: 'nguyenvana',
              fullName: 'Nguyễn Văn A',
              avatarUrl: 'https://example.com/avatars/user1.jpg',
              isOnline: true,
              lastSeen: '2025-07-22T10:30:00.000Z'
            },
            conversation: {
              id: '64f2b3c4d5e6f7a8b9c0d2e3',
              type: 'direct',
              createdAt: '2025-07-22T11:00:00.000Z',
              lastActivity: '2025-07-22T11:00:00.000Z'
            }
          }
        },
        existing_conversation: {
          summary: 'Existing conversation found',
          value: {
            conversationId: '64f2b3c4d5e6f7a8b9c0d2e3',
            exists: true,
            isActive: true,
            participant: {
              id: '64f1a2b3c4d5e6f7a8b9c0d1',
              username: 'nguyenvana',
              fullName: 'Nguyễn Văn A',
              avatarUrl: 'https://example.com/avatars/user1.jpg',
              isOnline: false,
              lastSeen: '2025-07-22T09:15:00.000Z'
            },
            conversation: {
              id: '64f2b3c4d5e6f7a8b9c0d2e3',
              type: 'direct',
              createdAt: '2025-07-21T14:30:00.000Z',
              lastActivity: '2025-07-22T08:45:00.000Z'
            }
          }
        }
      }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Target user not found',
      example: {
        statusCode: 404,
        message: 'Target user not found',
        error: 'Not Found',
        timestamp: '2025-07-22T11:00:00.000Z',
        path: '/api/v1/conversations/prepare'
      }
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Cannot create conversation with yourself',
      example: {
        statusCode: 400,
        message: 'Cannot create conversation with yourself',
        error: 'Bad Request',
        timestamp: '2025-07-22T11:00:00.000Z',
        path: '/api/v1/conversations/prepare'
      }
    }),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

/**
 * Get Conversation Details API Documentation
 * 
 * 🎯 Purpose: Get full conversation info for active conversations
 * 📱 UX: Load conversation details when entering chat screen
 */
export function GetConversationApiDocs() {
  return applyDecorators(
    ApiParam({
      name: 'conversationId',
      description: 'Conversation unique identifier',
      example: '64f1a2b3c4d5e6f7a8b9c0d1',
      schema: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$'
      }
    }),
    ApiOperation({
      summary: 'Get conversation details',
      description: `
            Retrieve full details of a conversation including participants and last message.
            
            **Use Cases:**
            - Load conversation when entering chat screen
            - Refresh conversation details
            - Get participant information
            - Check conversation status and permissions
            
            **Features:**
            - Full participant list with user details
            - Last message information
            - Online status of participants
            - Unread message count for current user
            `
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Conversation details retrieved successfully',
      type: ConversationResponseDto,
      examples: {
        active_conversation: {
          summary: 'Active conversation with messages',
          value: {
            id: '64f2b3c4d5e6f7a8b9c0d2e3',
            type: 'direct',
            participants: [
              {
                userId: '64f0a1b2c3d4e5f6a7b8c9d0',
                role: 'admin',
                joinedAt: '2025-07-22T11:00:00.000Z',
                user: {
                  id: '64f0a1b2c3d4e5f6a7b8c9d0',
                  username: 'currentuser',
                  fullName: 'Current User',
                  avatarUrl: 'https://example.com/avatars/current.jpg',
                  isOnline: true
                }
              },
              {
                userId: '64f1a2b3c4d5e6f7a8b9c0d1',
                role: 'admin',
                joinedAt: '2025-07-22T11:00:00.000Z',
                user: {
                  id: '64f1a2b3c4d5e6f7a8b9c0d1',
                  username: 'nguyenvana',
                  fullName: 'Nguyễn Văn A',
                  avatarUrl: 'https://example.com/avatars/user1.jpg',
                  isOnline: false
                }
              }
            ],
            createdBy: '64f0a1b2c3d4e5f6a7b8c9d0',
            createdAt: '2025-07-22T11:00:00.000Z',
            updatedAt: '2025-07-22T11:45:00.000Z',
            lastMessage: {
              id: '64f3c5d6e7f8a9b0c1d2e3f4',
              content: 'Cảm ơn bạn nhé! 👍',
              messageType: 'text',
              senderId: '64f1a2b3c4d5e6f7a8b9c0d1',
              createdAt: '2025-07-22T11:45:00.000Z'
            },
            isActive: true,
            unreadCount: 2
          }
        },
        dormant_conversation: {
          summary: 'Dormant conversation without messages',
          value: {
            id: '64f2b3c4d5e6f7a8b9c0d2e3',
            type: 'direct',
            participants: [
              {
                userId: '64f0a1b2c3d4e5f6a7b8c9d0',
                role: 'admin',
                joinedAt: '2025-07-22T11:00:00.000Z',
                user: {
                  id: '64f0a1b2c3d4e5f6a7b8c9d0',
                  username: 'currentuser',
                  fullName: 'Current User',
                  avatarUrl: 'https://example.com/avatars/current.jpg',
                  isOnline: true
                }
              },
              {
                userId: '64f1a2b3c4d5e6f7a8b9c0d1',
                role: 'admin',
                joinedAt: '2025-07-22T11:00:00.000Z',
                user: {
                  id: '64f1a2b3c4d5e6f7a8b9c0d1',
                  username: 'nguyenvana',
                  fullName: 'Nguyễn Văn A',
                  avatarUrl: 'https://example.com/avatars/user1.jpg',
                  isOnline: true
                }
              }
            ],
            createdBy: '64f0a1b2c3d4e5f6a7b8c9d0',
            createdAt: '2025-07-22T11:00:00.000Z',
            updatedAt: '2025-07-22T11:00:00.000Z',
            isActive: false,
            unreadCount: 0
          }
        }
      }
    }),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}
