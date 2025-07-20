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
 * Friends API Documentation
 * 
 * Following instruction-senior.md:
 * - Single Responsibility: Each function documents one endpoint
 * - Clean Architecture: Documentation separated from controller logic
 * - DRY Principle: Reusable error responses
 * - Domain Separation: Friends domain documentation in friends module
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
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/friends/*'
        }
    },
    unauthorized: {
        status: HttpStatus.UNAUTHORIZED,
        description: 'Unauthorized - invalid or missing JWT token',
        example: {
            statusCode: 401,
            message: 'Unauthorized',
            error: 'Unauthorized',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/friends/*'
        }
    },
    notFound: {
        status: HttpStatus.NOT_FOUND,
        description: 'User or friend request not found',
        example: {
            statusCode: 404,
            message: 'User not found',
            error: 'Not Found',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/friends/*'
        }
    },
    conflict: {
        status: HttpStatus.CONFLICT,
        description: 'Conflict - duplicate request or invalid state',
        example: {
            statusCode: 409,
            message: 'Friend request already exists',
            error: 'Conflict',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/friends/*'
        }
    },
    tooManyRequests: {
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Rate limit exceeded',
        example: {
            statusCode: 429,
            message: 'Too many requests. Please try again later.',
            error: 'Too Many Requests',
            timestamp: '2024-01-15T10:30:00.000Z',
            path: '/api/v1/friends/*'
        }
    }
};

/**
 * Send Friend Request endpoint documentation
 */
export function SendFriendRequestApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Send friend request to another user',
            description: `
## Send Friend Request

Sends a friend request to another user by phone number or user ID.

### Business Rules:
- Cannot send request to yourself
- Cannot send duplicate requests
- Target user must exist and be active
- Maximum 50 pending outgoing requests per user
- Blocked users cannot send/receive requests

### Mobile-First Features:
- Immediate status feedback
- Duplicate request prevention
- Bulk request capabilities
- Offline support with sync

### Security:
- JWT authentication required
- Rate limiting: 20 requests per minute
- Input validation and sanitization
- Audit logging for security monitoring
            `,
        }),
        ApiBody({
            description: 'Friend request data',
            examples: {
                'By Phone Number': {
                    summary: 'Send request using phone number',
                    value: {
                        phoneNumber: '+84987654321',
                        message: 'Hi! I would like to connect with you.'
                    }
                },
                'By User ID': {
                    summary: 'Send request using user ID',
                    value: {
                        targetUserId: '507f1f77bcf86cd799439012',
                        message: 'Hello from mutual contact!'
                    }
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.CREATED,
            description: 'Friend request sent successfully',
            example: {
                id: '507f1f77bcf86cd799439013',
                requester: {
                    id: '507f1f77bcf86cd799439011',
                    phoneNumber: '+84901234567',
                    fullName: 'Nguyen Van A',
                    avatarUrl: 'https://example.com/avatar1.jpg'
                },
                receiver: {
                    id: '507f1f77bcf86cd799439012',
                    phoneNumber: '+84987654321',
                    fullName: 'Tran Thi B',
                    avatarUrl: 'https://example.com/avatar2.jpg'
                },
                status: 'PENDING',
                message: 'Hi! I would like to connect with you.',
                createdAt: '2024-01-15T10:30:00.000Z',
                updatedAt: '2024-01-15T10:30:00.000Z'
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.conflict),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Respond to Friend Request endpoint documentation
 */
export function RespondToFriendRequestApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Accept or decline a friend request',
            description: `
## Respond to Friend Request

Accept or decline an incoming friend request.

### Business Rules:
- Only receiver can respond to requests
- Request must be in PENDING status
- Accepting creates bidirectional friendship
- Declining removes the request permanently

### Mobile-First Features:
- Instant response feedback
- Optimistic UI updates
- Batch response capabilities
- Push notifications to requester
            `,
        }),
        ApiParam({
            name: 'requestId',
            description: 'Friend request ID to respond to',
            example: '507f1f77bcf86cd799439013'
        }),
        ApiBody({
            description: 'Response data',
            examples: {
                'Accept Request': {
                    summary: 'Accept the friend request',
                    value: {
                        action: 'ACCEPT'
                    }
                },
                'Decline Request': {
                    summary: 'Decline the friend request',
                    value: {
                        action: 'DECLINE'
                    }
                }
            }
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Response processed successfully',
            example: {
                id: '507f1f77bcf86cd799439013',
                requester: {
                    id: '507f1f77bcf86cd799439012',
                    phoneNumber: '+84987654321',
                    fullName: 'Tran Thi B',
                    avatarUrl: 'https://example.com/avatar2.jpg'
                },
                receiver: {
                    id: '507f1f77bcf86cd799439011',
                    phoneNumber: '+84901234567',
                    fullName: 'Nguyen Van A',
                    avatarUrl: 'https://example.com/avatar1.jpg'
                },
                status: 'ACCEPTED',
                respondedAt: '2024-01-15T11:30:00.000Z',
                createdAt: '2024-01-15T10:30:00.000Z',
                updatedAt: '2024-01-15T11:30:00.000Z'
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Search Users endpoint documentation
 */
export function SearchUsersApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Search users với smart auto-detection',
            description: `
## Smart User Search with Auto-Detection

Intelligent search that automatically detects input type and searches accordingly.

### 🧠 Smart Detection Rules:
- **Phone Numbers**: Automatically detected from patterns
  - \`+84901234567\` (International format)
  - \`0901234567\` (Vietnam domestic)  
  - \`84901234567\` (Country code without +)
  - \`901234567\` (9-11 digits)

- **Names**: Everything else
  - \`Nguyen Van A\`
  - \`john doe\`
  - \`Mary Jane\`

### Features:
- **Auto-detection**: No need to specify search type
- **Exclude friends**: Won't show existing friends
- **Pending status**: Shows if friend request already sent
- **Mobile optimized**: Fast search with pagination
- **Security**: Input sanitization and validation

### Response includes:
- User basic info (name, avatar, phone)
- Friend status (isFriend, hasPendingRequest)
- Online status and last seen
- Mutual friends count
            `,
        }),
        ApiQuery({
            name: 'query',
            required: true,
            type: String,
            description: 'Search query (phone number or name)',
            example: '+84987654321'
        }),
        ApiQuery({
            name: 'limit',
            required: false,
            type: Number,
            description: 'Number of results (max 20)',
            example: 10
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Search results retrieved successfully',
            example: {
                users: [
                    {
                        id: '507f1f77bcf86cd799439012',
                        phoneNumber: '+84987654321',
                        fullName: 'Tran Thi B',
                        avatarUrl: 'https://example.com/avatar2.jpg',
                        mutualFriendsCount: 3,
                        canSendRequest: true
                    }
                ],
                total: 1
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Friends List endpoint documentation  
 */
export function GetFriendsListApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Get list of friends with bidirectional support',
            description: `
## Get Friends List with Enhanced Features

Retrieve paginated list of user's friends with bidirectional friendship support, Redis caching, and online status filtering.

### Key Enhancements:
- **Bidirectional Friendship**: Supports both userId and friendId relationships
- **Redis Caching**: 5-minute cache for unfiltered requests
- **Real-time Online Status**: Updated from Redis with WebSocket integration
- **Performance Optimized**: Aggregation pipeline with caching strategy

### Mobile-First Features:
- Optimized pagination for mobile
- Search by name or phone
- Online/offline status filtering
- Cached responses for performance

### Search & Filter:
- Search by name or phone number
- Filter by online status (true=online only, false=offline only, undefined=all)
- Sort by name, recent activity, or friendship date
            `,
        }),
        ApiQuery({
            name: 'search',
            required: false,
            type: String,
            description: 'Search friends by name or phone number',
            example: 'Nguyen'
        }),
        ApiQuery({
            name: 'page',
            required: false,
            type: Number,
            description: 'Page number (1-based)',
            example: 1
        }),
        ApiQuery({
            name: 'limit',
            required: false,
            type: Number,
            description: 'Number of friends per page (max 100)',
            example: 20
        }),
        // ApiQuery({
        //     name: 'onlineStatus',
        //     required: false,
        //     type: Boolean,
        //     description: 'Filter by online status (true=online only, false=offline only, undefined=all)',
        //     example: true
        // }),
        ApiQuery({
            name: 'sortBy',
            required: false,
            type: String,
            description: 'Sort by: recent, name, mutual',
            example: 'recent'
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Friends list retrieved successfully with enhanced features',
            example: {
                friends: [
                    {
                        id: '507f1f77bcf86cd799439012',
                        user: {
                            id: '507f1f77bcf86cd799439013',
                            fullName: 'Tran Thi B',
                            username: 'tranthib',
                            phoneNumber: '+84987654321',
                            avatarUrl: 'https://example.com/avatar2.jpg',
                            isOnline: true,
                            lastSeen: '2024-01-15T11:45:00.000Z'
                        },
                        isOnline: true,
                        lastSeen: '2024-01-15T11:45:00.000Z',
                        lastInteraction: '2024-01-15T10:30:00.000Z',
                        mutualFriendsCount: 5,
                        addMethod: 'contact_sync',
                        friendedAt: '2024-01-10T08:30:00.000Z'
                    }
                ],
                onlineCount: 12,
                total: 150,
                page: 1,
                totalPages: 8
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Friend Requests endpoint documentation
 */
export function GetFriendRequestsApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Get friend requests with comprehensive filtering',
            description: `
## Get Friend Requests

Retrieve friend requests with advanced filtering and pagination support.

### Query Parameters:
- **type**: Filter by request type (incoming/outgoing/all)
- **status**: Filter by status (PENDING/ACCEPTED/DECLINED)
- **limit**: Number of requests to return (1-100, default: 20)
- **offset**: Number of requests to skip (default: 0)

### Mobile Features:
- Comprehensive filtering by type and status
- Pagination for large request lists
- Request metadata (timestamps, messages, user info)
- Optimized for mobile performance
            `,
        }),
        ApiQuery({
            name: 'type',
            required: false,
            enum: ['incoming', 'outgoing', 'all'],
            description: 'Filter by request type',
            example: 'incoming'
        }),
        ApiQuery({
            name: 'status',
            required: false,
            enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
            description: 'Filter by request status',
            example: 'PENDING'
        }),
        ApiQuery({
            name: 'limit',
            required: false,
            type: Number,
            description: 'Number of requests to return (1-100)',
            example: 20
        }),
        ApiQuery({
            name: 'offset',
            required: false,
            type: Number,
            description: 'Number of requests to skip',
            example: 0
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Friend requests retrieved successfully',
            example: {
                requests: [
                    {
                        id: '507f1f77bcf86cd799439013',
                        userId: '507f1f77bcf86cd799439014',
                        friendId: '507f1f77bcf86cd799439015',
                        status: 'PENDING',
                        requestedBy: '507f1f77bcf86cd799439014',
                        requestMessage: 'Hi! Let\'s be friends',
                        addMethod: 'MANUAL',
                        createdAt: '2024-01-15T10:30:00.000Z',
                        updatedAt: '2024-01-15T10:30:00.000Z',
                        user: {
                            id: '507f1f77bcf86cd799439014',
                            fullName: 'John Doe',
                            username: 'johndoe',
                            phoneNumber: '+1234567890',
                            avatarUrl: 'https://example.com/avatar.jpg'
                        }
                    }
                ],
                total: 5,
                hasMore: false,
                type: 'incoming',
                status: 'PENDING',
                limit: 20,
                offset: 0
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Remove Friend endpoint documentation
 */
export function RemoveFriendApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Remove a friend',
            description: `
## Remove Friend

Remove a user from your friends list. This action is permanent.

### Mobile Features:
- Immediate friend list updates
- Confirmation before removal
- Audit trail maintenance
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Friend removed successfully',
            example: {
                message: 'Friend removed successfully'
            }
        }),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Block User endpoint documentation
 */
export function BlockUserApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Block a user',
            description: `
## Block User

Block a user to prevent them from sending messages or friend requests.

### Privacy Features:
- Prevents all future contact attempts
- Removes from friends list if applicable
- Optional reason for blocking
- Reversible action
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'User blocked successfully',
            example: {
                message: 'User blocked successfully',
                blockedAt: '2024-01-15T10:30:00.000Z'
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Unblock User endpoint documentation
 */
export function UnblockUserApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Unblock a previously blocked user',
            description: `
## Unblock User

Remove a user from your blocked list, allowing them to contact you again.

### Privacy Features:
- Restores normal contact permissions
- User can send friend requests again
- Audit trail maintained
            `,
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'User unblocked successfully',
            example: {
                message: 'User unblocked successfully'
            }
        }),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}

/**
 * Get Friend Status endpoint documentation
 */
export function GetFriendStatusApiDocs() {
    return applyDecorators(
        ApiBearerAuth('JWT'),
        ApiOperation({
            summary: 'Get comprehensive friendship status with another user',
            description: `
## Get Friend Status

Check the detailed relationship status with another user.

### Status Types:
- **FRIENDS**: Users are friends (can send messages)
- **PENDING_OUTGOING**: Friend request sent (waiting for acceptance)
- **PENDING_INCOMING**: Friend request received (can accept/decline)
- **BLOCKED**: User is blocked (no interaction allowed)
- **NONE**: No relationship (can send friend request)

### Mobile Features:
- Detailed status with permissions
- Pending request information
- Friendship date tracking
- Message and request capabilities
            `,
        }),
        ApiParam({
            name: 'userId',
            description: 'Target user ID to check friendship status',
            example: '507f1f77bcf86cd799439013'
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Friend status retrieved successfully',
            example: {
                status: 'FRIENDS',
                canSendMessage: true,
                canSendFriendRequest: false,
                friendshipDate: '2024-01-10T08:30:00.000Z'
            }
        }),
        ApiResponse({
            status: HttpStatus.OK,
            description: 'Pending request status example',
            example: {
                status: 'PENDING_INCOMING',
                canSendMessage: false,
                canSendFriendRequest: false,
                pendingRequest: {
                    id: '507f1f77bcf86cd799439014',
                    type: 'incoming',
                    createdAt: '2024-01-15T10:30:00.000Z'
                }
            }
        }),
        ApiResponse(commonErrorResponses.badRequest),
        ApiResponse(commonErrorResponses.unauthorized),
        ApiResponse(commonErrorResponses.notFound),
        ApiResponse(commonErrorResponses.tooManyRequests),
    );
}
