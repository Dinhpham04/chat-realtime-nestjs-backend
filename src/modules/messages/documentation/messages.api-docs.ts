import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';

/**
 * Messages API Documentation
 * 
 * Following instruction-senior.md:
 * - Single Responsibility: Each function documents one endpoint
 * - Clean Architecture: Documentation separated from controller logic
 * - DRY Principle: Reusable error responses
 * - Domain Separation: Messages domain documentation in messages module
 */

// Common error responses for reusability
const commonErrorResponses = {
    badRequest: {
        status: HttpStatus.BAD_REQUEST,
        description: 'Validation errors in request data',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['conversationId should not be empty', 'content must be a string']
                },
                error: { type: 'string', example: 'Bad Request' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
                path: { type: 'string', example: '/api/v1/messages' }
            }
        }
    },
    unauthorized: {
        status: HttpStatus.UNAUTHORIZED,
        description: 'Unauthorized - invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
                error: { type: 'string', example: 'Unauthorized' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
                path: { type: 'string', example: '/api/v1/messages' }
            }
        }
    },
    forbidden: {
        status: HttpStatus.FORBIDDEN,
        description: 'Forbidden - user not member of conversation or insufficient permissions',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: { type: 'string', example: 'User is not a member of this conversation' },
                error: { type: 'string', example: 'Forbidden' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
                path: { type: 'string', example: '/api/v1/messages' }
            }
        }
    },
    notFound: {
        status: HttpStatus.NOT_FOUND,
        description: 'Message, conversation, or user not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: { type: 'string', example: 'Message not found' },
                error: { type: 'string', example: 'Not Found' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
                path: { type: 'string', example: '/api/v1/messages/msg_123' }
            }
        }
    },
    internalServerError: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: 'Internal server error',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { type: 'string', example: 'Internal server error' },
                error: { type: 'string', example: 'Internal Server Error' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
                path: { type: 'string', example: '/api/v1/messages' }
            }
        }
    }
};

/**
 * Documentation for Send Message endpoint
 * 
 * 🎯 Purpose: Send a new message to a conversation
 * 📱 Use Case: Primary messaging functionality (fallback when Socket.IO fails)
 * 🔐 Security: Requires JWT authentication + conversation membership
 * 
 * Request Flow:
 * 1. Validate JWT token
 * 2. Verify user is member of conversation
 * 3. Process message content and attachments
 * 4. Save to database
 * 5. Emit real-time event to conversation members
 * 6. Return message with server ID and timestamp
 */
export const SendMessageDocs = applyDecorators(
    ApiOperation({
        summary: 'Send a new message',
        description: `
        **Primary Use Case**: Fallback when Socket.IO connection fails
        
        **Real-time Flow**: This endpoint complements Socket.IO for reliable message delivery
        
        **Parameters Explained**:
        - **localId**: Client-generated UUID for optimistic UI updates (optional)
        - **conversationId**: Target conversation UUID (required)
        - **content**: Message text content (optional - can be null for file-only messages)
        - **type**: Message type enum (text, image, video, audio, file, location, contact, sticker)
        - **attachments**: Array of file attachments with metadata
        - **replyToMessageId**: UUID of message being replied to (optional)
        - **mentions**: Array of user UUIDs mentioned in message (optional)
        
        **Business Logic**:
        1. Validates user membership in conversation
        2. Processes attachments and validates file access
        3. Creates message with optimistic concurrency control
        4. Triggers real-time notifications to online users
        5. Queues push notifications for offline users
        6. Updates conversation last_message timestamp
        
        **Response**: Returns complete message object with server-generated ID and timestamps
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({
        description: 'Message creation data with detailed validation',
        schema: {
            type: 'object',
            required: ['conversationId'],
            properties: {
                localId: {
                    type: 'string',
                    description: 'Client-generated UUID for optimistic UI (matches with Socket.IO response)',
                    example: 'local_msg_1234567890',
                    pattern: '^[a-zA-Z0-9_-]+$',
                    minLength: 1,
                    maxLength: 50
                },
                conversationId: {
                    type: 'string',
                    description: 'Target conversation UUID (must be valid conversation where user is member)',
                    example: 'conv_67890abcdef',
                    pattern: '^[a-zA-Z0-9_-]+$',
                    minLength: 10,
                    maxLength: 50
                },
                content: {
                    type: 'string',
                    description: 'Message text content (supports markdown, mentions with @username)',
                    example: 'Hello @john! How are you today? 😊',
                    maxLength: 10000,
                    nullable: true
                },
                type: {
                    type: 'string',
                    enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker', 'system'],
                    description: 'Message type determining how content is rendered in UI',
                    example: 'text',
                    default: 'text'
                },
                attachments: {
                    type: 'array',
                    description: 'File attachments with metadata (uploaded via Files module)',
                    items: {
                        type: 'object',
                        required: ['fileId', 'fileName', 'mimeType', 'fileSize'],
                        properties: {
                            fileId: {
                                type: 'string',
                                description: 'File UUID from Files service upload',
                                example: 'file_abc123def456'
                            },
                            fileName: {
                                type: 'string',
                                description: 'Original filename with extension',
                                example: 'vacation_photo.jpg'
                            },
                            mimeType: {
                                type: 'string',
                                description: 'File MIME type for proper rendering',
                                example: 'image/jpeg'
                            },
                            fileSize: {
                                type: 'number',
                                description: 'File size in bytes',
                                example: 2048576
                            },
                            thumbnailUrl: {
                                type: 'string',
                                description: 'CDN URL for image/video thumbnails',
                                example: 'https://cdn.example.com/thumbs/file_abc123_thumb.jpg',
                                nullable: true
                            },
                            width: {
                                type: 'number',
                                description: 'Image/video width in pixels',
                                example: 1920,
                                nullable: true
                            },
                            height: {
                                type: 'number',
                                description: 'Image/video height in pixels',
                                example: 1080,
                                nullable: true
                            },
                            duration: {
                                type: 'number',
                                description: 'Audio/video duration in seconds',
                                example: 120.5,
                                nullable: true
                            }
                        }
                    }
                },
                replyToMessageId: {
                    type: 'string',
                    description: 'UUID of message being replied to (creates threaded conversation)',
                    example: 'msg_xyz789abc123',
                    nullable: true
                },
                mentions: {
                    type: 'array',
                    description: 'Array of user UUIDs mentioned in message (triggers notifications)',
                    items: {
                        type: 'string',
                        description: 'User UUID',
                        example: 'user_123abc456def'
                    }
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Message sent successfully with server-generated metadata',
        schema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'Server-generated message UUID',
                    example: 'msg_abc123def456'
                },
                localId: {
                    type: 'string',
                    description: 'Client-provided local ID (if provided)',
                    example: 'local_msg_1234567890'
                },
                conversationId: {
                    type: 'string',
                    description: 'Conversation UUID',
                    example: 'conv_67890abcdef'
                },
                senderId: {
                    type: 'string',
                    description: 'Sender user UUID',
                    example: 'user_sender123'
                },
                content: {
                    type: 'string',
                    description: 'Message text content',
                    example: 'Hello @john! How are you today? 😊'
                },
                type: {
                    type: 'string',
                    description: 'Message type',
                    example: 'text'
                },
                attachments: {
                    type: 'array',
                    description: 'Processed attachments with CDN URLs',
                    items: { type: 'object' }
                },
                replyTo: {
                    type: 'object',
                    description: 'Referenced message data (if reply)',
                    nullable: true
                },
                mentions: {
                    type: 'array',
                    description: 'Mentioned users with profiles',
                    items: { type: 'object' }
                },
                status: {
                    type: 'string',
                    enum: ['sent', 'delivered', 'read'],
                    description: 'Message delivery status',
                    example: 'sent'
                },
                createdAt: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Server timestamp when message was created',
                    example: '2024-01-15T10:30:00.000Z'
                },
                updatedAt: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Server timestamp when message was last updated',
                    example: '2024-01-15T10:30:00.000Z'
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Get Conversation Messages endpoint
 * 
 * 🎯 Purpose: Retrieve message history with pagination
 * 📱 Use Case: Load conversation history, infinite scroll
 * 🔐 Security: Requires JWT + conversation membership
 */
export const GetConversationMessagesDocs = applyDecorators(
    ApiOperation({
        summary: 'Get conversation messages',
        description: `
        **Primary Use Case**: Load conversation history with pagination support
        
        **Pagination Strategy**: Supports both offset-based and cursor-based pagination
        
        **Parameters Explained**:
        - **conversationId**: Target conversation UUID (path parameter)
        - **page**: Page number for offset pagination (starts from 1)
        - **limit**: Messages per page (max 100, default 20)
        - **cursor**: Timestamp cursor for cursor-based pagination (more efficient)
        
        **Business Logic**:
        1. Validates user membership in conversation
        2. Applies pagination with performance optimization
        3. Sorts messages chronologically (newest first)
        4. Includes sender profile data and attachment metadata
        5. Marks messages as delivered for requesting user
        
        **Performance**: Uses MongoDB indexes for efficient queries
        **Response**: Paginated message list with metadata
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'conversationId',
        description: 'Conversation UUID to retrieve messages from (user must be member)',
        example: 'conv_67890abcdef',
        type: 'string'
    }),
    ApiQuery({
        name: 'page',
        description: 'Page number for offset pagination (starts from 1, max depends on total)',
        example: 1,
        type: 'number',
        required: false
    }),
    ApiQuery({
        name: 'limit',
        description: 'Number of messages per page (min 1, max 100, default 20)',
        example: 20,
        type: 'number',
        required: false
    }),
    ApiQuery({
        name: 'cursor',
        description: 'ISO timestamp cursor for efficient pagination (alternative to page/limit)',
        example: '2024-01-15T10:30:00.000Z',
        type: 'string',
        required: false
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Messages retrieved successfully with pagination metadata',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    description: 'Array of message objects',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', example: 'msg_abc123' },
                            content: { type: 'string', example: 'Hello world!' },
                            senderId: { type: 'string', example: 'user_123' },
                            type: { type: 'string', example: 'text' },
                            createdAt: { type: 'string', example: '2024-01-15T10:30:00.000Z' }
                        }
                    }
                },
                pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 20 },
                        total: { type: 'number', example: 150 },
                        hasNext: { type: 'boolean', example: true },
                        hasPrev: { type: 'boolean', example: false },
                        nextCursor: { type: 'string', example: '2024-01-15T10:29:00.000Z' },
                        prevCursor: { type: 'string', example: '2024-01-15T10:31:00.000Z' }
                    }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Search Messages endpoint
 * 
 * 🎯 Purpose: Full-text search within conversation
 * 📱 Use Case: Find specific messages, search by content/sender/type
 * 🔐 Security: Requires JWT + conversation membership
 */
export const SearchMessagesDocs = applyDecorators(
    ApiOperation({
        summary: 'Search messages in conversation',
        description: `
        **Primary Use Case**: Find messages using full-text search and filters
        
        **Search Capabilities**:
        - Full-text search in message content
        - Filter by message type (text, image, file, etc.)
        - Filter by sender
        - Date range filtering
        - Attachment presence filtering
        
        **Parameters Explained**:
        - **conversationId**: Target conversation UUID (path parameter)
        - **query**: Search text (searches in message content using MongoDB text index)
        - **type**: Filter by message type enum
        - **senderId**: Filter by specific sender UUID
        - **fromDate**: Start date for date range filter (ISO format)
        - **toDate**: End date for date range filter (ISO format)
        
        **Performance**: Uses MongoDB text indexes and compound indexes
        **Response**: Paginated search results with relevance scoring
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'conversationId',
        description: 'Conversation UUID to search within (user must be member)',
        example: 'conv_67890abcdef',
        type: 'string'
    }),
    ApiQuery({
        name: 'query',
        description: 'Search text to find in message content (supports partial matching)',
        example: 'hello world meeting',
        type: 'string'
    }),
    ApiQuery({
        name: 'type',
        description: 'Filter by message type',
        enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'contact', 'sticker'],
        required: false
    }),
    ApiQuery({
        name: 'senderId',
        description: 'Filter by sender user UUID',
        example: 'user_123abc456',
        type: 'string',
        required: false
    }),
    ApiQuery({
        name: 'fromDate',
        description: 'Start date for date range filter (ISO 8601 format)',
        example: '2024-01-01T00:00:00.000Z',
        type: 'string',
        required: false
    }),
    ApiQuery({
        name: 'toDate',
        description: 'End date for date range filter (ISO 8601 format)',
        example: '2024-01-31T23:59:59.999Z',
        type: 'string',
        required: false
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Search results with relevance scoring',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    description: 'Search results sorted by relevance',
                    items: { type: 'object' }
                },
                pagination: {
                    type: 'object',
                    properties: {
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        total: { type: 'number' }
                    }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Edit Message endpoint
 * 
 * 🎯 Purpose: Edit existing message content
 * 📱 Use Case: Fix typos, update message content
 * 🔐 Security: User can only edit own messages + time limit
 */
export const EditMessageDocs = applyDecorators(
    ApiOperation({
        summary: 'Edit a message',
        description: `
        **Primary Use Case**: Allow users to edit their own messages within time limit
        
        **Business Rules**:
        - Users can only edit their own messages
        - Edit window: 15 minutes after sending (configurable)
        - Edit history is preserved for audit
        - Real-time update to all conversation members
        
        **Parameters Explained**:
        - **messageId**: UUID of message to edit (path parameter)
        - **content**: New message content (required)
        - **attachments**: Updated attachment list (optional)
        
        **Security**: Validates message ownership and edit permissions
        **Response**: Updated message with edit timestamp and history
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'messageId',
        description: 'Message UUID to edit (user must be the sender)',
        example: 'msg_abc123def456',
        type: 'string'
    }),
    ApiBody({
        description: 'Updated message content',
        schema: {
            type: 'object',
            required: ['content'],
            properties: {
                content: {
                    type: 'string',
                    description: 'Updated message text content',
                    example: 'Updated message content with corrections',
                    maxLength: 10000
                },
                attachments: {
                    type: 'array',
                    description: 'Updated attachments list (replaces existing)',
                    items: { type: 'object' }
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Message edited successfully',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'msg_abc123' },
                content: { type: 'string', example: 'Updated content' },
                isEdited: { type: 'boolean', example: true },
                editedAt: { type: 'string', example: '2024-01-15T10:35:00.000Z' },
                editHistory: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            content: { type: 'string' },
                            editedAt: { type: 'string' }
                        }
                    }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Delete Message endpoint
 * 
 * 🎯 Purpose: Soft delete message
 * 📱 Use Case: Remove inappropriate content, user regret
 * 🔐 Security: User can delete own messages or admins can delete any
 */
export const DeleteMessageDocs = applyDecorators(
    ApiOperation({
        summary: 'Delete a message',
        description: `
        **Primary Use Case**: Soft delete messages (preserves data for audit)
        
        **Business Rules**:
        - Users can delete their own messages (any time)
        - Conversation admins can delete any message
        - Soft delete: message marked as deleted but preserved in DB
        - Real-time removal from all conversation members
        
        **Parameters Explained**:
        - **messageId**: UUID of message to delete (path parameter)
        
        **Security**: Validates deletion permissions based on ownership/admin role
        **Response**: No content (204) on successful deletion
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'messageId',
        description: 'Message UUID to delete (user must own message or be admin)',
        example: 'msg_abc123def456',
        type: 'string'
    }),
    ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'Message deleted successfully (soft delete)'
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Mark as Read endpoint
 * 
 * 🎯 Purpose: Mark message as read by current user
 * 📱 Use Case: Read receipts, unread count management
 * 🔐 Security: User can only mark messages as read for themselves
 */
export const MarkAsReadDocs = applyDecorators(
    ApiOperation({
        summary: 'Mark message as read',
        description: `
        **Primary Use Case**: Update read status for read receipts and unread counters
        
        **Business Logic**:
        - Updates message status to 'read' for current user
        - Triggers read receipt to message sender (if enabled)
        - Updates conversation unread count
        - Real-time update to sender about read status
        
        **Parameters Explained**:
        - **messageId**: UUID of message to mark as read (path parameter)
        
        **Security**: User can only mark messages as read for themselves
        **Response**: No content (204) on successful update
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'messageId',
        description: 'Message UUID to mark as read',
        example: 'msg_abc123def456',
        type: 'string'
    }),
    ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: 'Message marked as read successfully'
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Bulk Operations endpoint
 * 
 * 🎯 Purpose: Perform operations on multiple messages
 * 📱 Use Case: Select multiple messages and delete/mark read
 * 🔐 Security: Validates permissions for each message individually
 */
export const BulkOperationDocs = applyDecorators(
    ApiOperation({
        summary: 'Bulk operations on messages',
        description: `
        **Primary Use Case**: Perform batch operations for efficiency
        
        **Supported Operations**:
        - 'delete': Soft delete multiple messages
        - 'mark_read': Mark multiple messages as read
        - 'mark_unread': Mark multiple messages as unread
        
        **Parameters Explained**:
        - **messageIds**: Array of message UUIDs to operate on
        - **operation**: Operation type enum
        
        **Business Logic**:
        - Validates permissions for each message individually
        - Processes operations in transaction for consistency
        - Returns success/failure status for each message
        
        **Performance**: Optimized bulk database operations
        **Response**: Array of operation results per message
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiBody({
        description: 'Bulk operation data',
        schema: {
            type: 'object',
            required: ['messageIds', 'operation'],
            properties: {
                messageIds: {
                    type: 'array',
                    description: 'Array of message UUIDs to operate on (max 100)',
                    items: {
                        type: 'string',
                        example: 'msg_abc123def456'
                    },
                    maxItems: 100,
                    minItems: 1
                },
                operation: {
                    type: 'string',
                    enum: ['delete', 'mark_read', 'mark_unread'],
                    description: 'Operation to perform on all selected messages',
                    example: 'mark_read'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Bulk operation completed with individual results',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'number', example: 8 },
                failed: { type: 'number', example: 2 },
                results: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            messageId: { type: 'string', example: 'msg_abc123' },
                            success: { type: 'boolean', example: true },
                            error: { type: 'string', example: 'Permission denied' }
                        }
                    }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Forward Message endpoint
 * 
 * 🎯 Purpose: Forward message to other conversations
 * 📱 Use Case: Share message content with other groups/contacts
 * 🔐 Security: User must be member of target conversations
 */
export const ForwardMessageDocs = applyDecorators(
    ApiOperation({
        summary: 'Forward message to other conversations',
        description: `
        **Primary Use Case**: Share message content across conversations
        
        **Business Logic**:
        - Creates new messages in target conversations
        - Preserves original message reference
        - Validates user membership in target conversations
        - Maintains forwarding chain tracking
        
        **Parameters Explained**:
        - **messageId**: UUID of message to forward (path parameter)
        - **conversationIds**: Array of target conversation UUIDs
        
        **Security**: Validates membership in all target conversations
        **Response**: Array of created messages in target conversations
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'messageId',
        description: 'Message UUID to forward',
        example: 'msg_abc123def456',
        type: 'string'
    }),
    ApiBody({
        description: 'Target conversations for forwarding',
        schema: {
            type: 'object',
            required: ['conversationIds'],
            properties: {
                conversationIds: {
                    type: 'array',
                    description: 'Array of conversation UUIDs to forward message to',
                    items: {
                        type: 'string',
                        example: 'conv_xyz789abc123'
                    },
                    maxItems: 10,
                    minItems: 1
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Message forwarded successfully to all target conversations',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'msg_forwarded123' },
                    conversationId: { type: 'string', example: 'conv_target123' },
                    content: { type: 'string', example: 'Forwarded message content' },
                    forwardedFrom: { type: 'string', example: 'msg_original123' },
                    createdAt: { type: 'string', example: '2024-01-15T10:30:00.000Z' }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.notFound),
    ApiResponse(commonErrorResponses.internalServerError)
);

/**
 * Documentation for Message Analytics endpoint
 * 
 * 🎯 Purpose: Get conversation message statistics
 * 📱 Use Case: Admin insights, conversation health metrics
 * 🔐 Security: Requires conversation membership or admin role
 */
export const MessageAnalyticsDocs = applyDecorators(
    ApiOperation({
        summary: 'Get message analytics for conversation',
        description: `
        **Primary Use Case**: Analytics and insights for conversation activity
        
        **Analytics Provided**:
        - Total message count
        - Messages per day average
        - Most active users ranking
        - Message type distribution
        - Peak activity hours
        - Response time metrics
        
        **Parameters Explained**:
        - **conversationId**: Target conversation UUID (path parameter)
        
        **Business Logic**:
        - Aggregates data using MongoDB aggregation pipeline
        - Calculates metrics for last 30 days
        - Anonymizes data for privacy compliance
        
        **Performance**: Uses pre-aggregated data where possible
        **Response**: Comprehensive analytics object
        `
    }),
    ApiBearerAuth('JWT-auth'),
    ApiParam({
        name: 'conversationId',
        description: 'Conversation UUID to get analytics for',
        example: 'conv_67890abcdef',
        type: 'string'
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Analytics data retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                totalMessages: {
                    type: 'number',
                    description: 'Total messages in conversation',
                    example: 1250
                },
                messagesPerDay: {
                    type: 'number',
                    description: 'Average messages per day (last 30 days)',
                    example: 42.5
                },
                mostActiveUsers: {
                    type: 'array',
                    description: 'Users ranked by message count',
                    items: {
                        type: 'object',
                        properties: {
                            userId: { type: 'string', example: 'user_123' },
                            messageCount: { type: 'number', example: 125 }
                        }
                    }
                },
                messageTypeDistribution: {
                    type: 'object',
                    description: 'Count of messages by type',
                    properties: {
                        text: { type: 'number', example: 1000 },
                        image: { type: 'number', example: 150 },
                        file: { type: 'number', example: 50 },
                        video: { type: 'number', example: 30 }
                    }
                }
            }
        }
    }),
    ApiResponse(commonErrorResponses.unauthorized),
    ApiResponse(commonErrorResponses.forbidden),
    ApiResponse(commonErrorResponses.internalServerError)
);
