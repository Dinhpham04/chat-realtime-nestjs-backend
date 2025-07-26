/**
 * Participant Management API Documentation
 * 
 * 🎯 Purpose: Swagger documentation for participant management endpoints
 * 📱 Mobile-First: Optimized for mobile group management UX
 * 🔒 Security: Admin-only operations with proper validation
 */

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
    AddParticipantsDto,
    UpdateParticipantRoleDto,
    AddParticipantsResponseDto,
    UpdateParticipantRoleResponseDto,
    RemoveParticipantResponseDto,
    LeaveConversationResponseDto
} from '../dto';

/**
 * Add Participants API Documentation
 */
export const AddParticipantsApiDocs = () => applyDecorators(
    ApiOperation({
        summary: 'Add participants to group conversation',
        description: `
🎯 **Purpose**: Add multiple users to group conversation
📱 **UX**: Group admin invites contacts to join conversation
🔒 **Security**: Only group admins can add participants

**Business Rules:**
- Only group conversations support adding participants
- Only admins can add new participants
- Maximum group size: 1000 participants
- Users must exist and not already be participants
- Bulk operation with partial success support

**Use Cases:**
- Group admin invites friends to chat
- Adding colleagues to work group
- Expanding family group conversation
    `,
    }),
    ApiParam({
        name: 'conversationId',
        description: 'Group conversation unique identifier',
        example: '507f1f77bcf86cd799439011'
    }),
    ApiBody({
        type: AddParticipantsDto,
        description: 'List of users to add and their role',
        examples: {
            'single-member': {
                summary: 'Add single member',
                value: {
                    userIds: ['user-123'],
                    role: 'member'
                }
            },
            'multiple-users': {
                summary: 'Add multiple members',
                value: {
                    userIds: ['user-123', 'user-456', 'user-789'],
                    role: 'member'
                }
            },
            'add-admin': {
                summary: 'Add new admin',
                value: {
                    userIds: ['user-123'],
                    role: 'admin'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Participants successfully added',
        type: AddParticipantsResponseDto,
        content: {
            'application/json': {
                example: {
                    added: [
                        {
                            userId: 'user-123',
                            role: 'member',
                            joinedAt: '2024-01-15T10:30:00.000Z',
                            addedBy: 'admin-456',
                            user: {
                                id: 'user-123',
                                username: 'john_doe',
                                fullName: 'John Doe',
                                avatarUrl: 'https://example.com/avatar.jpg',
                                isOnline: true
                            }
                        }
                    ],
                    failed: [
                        {
                            userId: 'user-999',
                            reason: 'User not found'
                        }
                    ],
                    totalParticipants: 15
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request - not a group or limit exceeded',
        content: {
            'application/json': {
                examples: {
                    'not-group': {
                        summary: 'Not a group conversation',
                        value: {
                            statusCode: 400,
                            message: 'Can only add participants to group conversations',
                            error: 'Bad Request'
                        }
                    },
                    'limit-exceeded': {
                        summary: 'Group size limit exceeded',
                        value: {
                            statusCode: 400,
                            message: 'Group participant limit (1000) would be exceeded',
                            error: 'Bad Request'
                        }
                    }
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'User is not admin of the group',
        content: {
            'application/json': {
                example: {
                    statusCode: 403,
                    message: 'Only admins can add participants',
                    error: 'Forbidden'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Conversation not found',
        content: {
            'application/json': {
                example: {
                    statusCode: 404,
                    message: 'Conversation not found',
                    error: 'Not Found'
                }
            }
        }
    }),
    ApiBearerAuth('JWT-auth')
);

/**
 * Update Participant Role API Documentation
 */
export const UpdateParticipantRoleApiDocs = () => applyDecorators(
    ApiOperation({
        summary: 'Update participant role in conversation',
        description: `
🎯 **Purpose**: Promote or demote participant role (admin ↔ member)
📱 **UX**: Group admin manages member permissions
🔒 **Security**: Only admins can change roles

**Business Rules:**
- Only group conversations have roles
- Only admins can change other participants' roles
- Cannot demote yourself if you're the last admin
- Role changes are immediately effective

**Use Cases:**
- Promote trusted member to admin
- Demote admin to regular member
- Rotate admin responsibilities
    `,
    }),
    ApiParam({
        name: 'conversationId',
        description: 'Group conversation unique identifier',
        example: '507f1f77bcf86cd799439011'
    }),
    ApiParam({
        name: 'userId',
        description: 'User whose role to update',
        example: 'user-123'
    }),
    ApiBody({
        type: UpdateParticipantRoleDto,
        description: 'New role for the participant',
        examples: {
            'promote-to-admin': {
                summary: 'Promote member to admin',
                value: {
                    role: 'admin'
                }
            },
            'demote-to-member': {
                summary: 'Demote admin to member',
                value: {
                    role: 'member'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Participant role successfully updated',
        type: UpdateParticipantRoleResponseDto,
        content: {
            'application/json': {
                example: {
                    participant: {
                        userId: 'user-123',
                        role: 'admin',
                        joinedAt: '2024-01-10T08:00:00.000Z',
                        addedBy: 'admin-456',
                        user: {
                            id: 'user-123',
                            username: 'john_doe',
                            fullName: 'John Doe',
                            avatarUrl: 'https://example.com/avatar.jpg',
                            isOnline: true
                        }
                    },
                    previousRole: 'member',
                    updatedAt: '2024-01-15T10:30:00.000Z'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request or last admin restriction',
        content: {
            'application/json': {
                examples: {
                    'not-group': {
                        summary: 'Not a group conversation',
                        value: {
                            statusCode: 400,
                            message: 'Can only manage roles in group conversations',
                            error: 'Bad Request'
                        }
                    },
                    'last-admin': {
                        summary: 'Cannot demote last admin',
                        value: {
                            statusCode: 400,
                            message: 'Cannot demote yourself as the last admin. Promote another user first.',
                            error: 'Bad Request'
                        }
                    }
                }
            }
        }
    }),
    ApiBearerAuth('JWT-auth')
);

/**
 * Remove Participant API Documentation
 */
export const RemoveParticipantApiDocs = () => applyDecorators(
    ApiOperation({
        summary: 'Remove participant from conversation',
        description: `
🎯 **Purpose**: Remove user from group conversation (kick)
📱 **UX**: Admin can remove disruptive or unwanted members
🔒 **Security**: Only admins can remove other participants

**Business Rules:**
- Only group conversations support removing participants
- Only admins can remove other participants
- Cannot remove yourself (use leave instead)
- Cannot remove last admin without promoting someone else first

**Use Cases:**
- Remove disruptive member from group
- Clean up inactive participants
- Moderate group membership
    `,
    }),
    ApiParam({
        name: 'conversationId',
        description: 'Group conversation unique identifier',
        example: '507f1f77bcf86cd799439011'
    }),
    ApiParam({
        name: 'userId',
        description: 'User to remove from conversation',
        example: 'user-123'
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Participant successfully removed',
        type: RemoveParticipantResponseDto,
        content: {
            'application/json': {
                example: {
                    success: true,
                    removedUserId: 'user-123',
                    removedAt: '2024-01-15T10:30:00.000Z',
                    remainingParticipants: 14
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request or restriction violation',
        content: {
            'application/json': {
                examples: {
                    'self-remove': {
                        summary: 'Cannot remove yourself',
                        value: {
                            statusCode: 400,
                            message: 'Cannot remove yourself. Use leave conversation instead.',
                            error: 'Bad Request'
                        }
                    },
                    'last-admin': {
                        summary: 'Cannot remove last admin',
                        value: {
                            statusCode: 400,
                            message: 'Cannot remove the last admin. Promote another user first.',
                            error: 'Bad Request'
                        }
                    }
                }
            }
        }
    }),
    ApiBearerAuth('JWT-auth')
);

/**
 * Leave Conversation API Documentation
 */
export const LeaveConversationApiDocs = () => applyDecorators(
    ApiOperation({
        summary: 'Leave conversation',
        description: `
🎯 **Purpose**: Current user leaves the conversation
📱 **UX**: User can exit group conversation they no longer want to be in
🔒 **Security**: User can only remove themselves

**Business Rules:**
- Any participant can leave a conversation
- If last admin leaves, must promote another member first
- Direct conversations cannot be left (only archived)
- Leaving is permanent (must be re-invited)

**Use Cases:**
- User exits group they're no longer interested in
- Leave work group after changing jobs
- Exit family group after moving out
    `,
    }),
    ApiParam({
        name: 'conversationId',
        description: 'Conversation to leave',
        example: '507f1f77bcf86cd799439011'
    }),
    ApiResponse({
        status: HttpStatus.OK,
        description: 'Successfully left conversation',
        type: LeaveConversationResponseDto,
        content: {
            'application/json': {
                example: {
                    success: true,
                    leftAt: '2024-01-15T10:30:00.000Z',
                    remainingParticipants: 13
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Cannot leave due to restrictions',
        content: {
            'application/json': {
                example: {
                    statusCode: 400,
                    message: 'As the last admin, you must promote another member before leaving',
                    error: 'Bad Request'
                }
            }
        }
    }),
    ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User is not a participant in this conversation',
        content: {
            'application/json': {
                example: {
                    statusCode: 404,
                    message: 'You are not a participant in this conversation',
                    error: 'Not Found'
                }
            }
        }
    }),
    ApiBearerAuth('JWT-auth')
);
