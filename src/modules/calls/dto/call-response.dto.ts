import { ApiProperty } from '@nestjs/swagger';
import { CallStatus, CallType } from '../schemas/call.schema';

export class CallDataResponseDto {
  @ApiProperty({
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123'
  })
  callId: string;

  @ApiProperty({
    description: 'Current status of the call',
    enum: CallStatus,
    example: 'ringing'
  })
  status: CallStatus;

  @ApiProperty({
    description: 'Type of the call',
    enum: CallType,
    example: 'voice'
  })
  type?: CallType;

  @ApiProperty({
    description: 'ID of the target user',
    example: 'user456'
  })
  targetUserId?: string;

  @ApiProperty({
    description: 'Additional message',
    example: 'Call initiated successfully'
  })
  message?: string;

  @ApiProperty({
    description: 'List of participant user IDs',
    type: [String],
    example: ['user123', 'user456']
  })
  participants?: string[];

  @ApiProperty({
    description: 'When the call was created',
    example: '2025-01-01T12:00:00Z'
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Last activity timestamp',
    example: '2025-01-01T12:05:00Z'
  })
  lastActivity?: Date;

  @ApiProperty({
    description: 'Current user ID',
    example: 'user123'
  })
  userId?: string;

  @ApiProperty({
    description: 'Current call ID for user status',
    example: 'call_1704567890_abc123'
  })
  currentCallId?: string;
}

export class CallResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
    type: CallDataResponseDto,
    required: false
  })
  data?: CallDataResponseDto;

  @ApiProperty({
    description: 'Error information if operation failed',
    required: false,
    example: {
      type: 'user_busy',
      message: 'Target user is currently busy',
      userFriendly: {
        title: 'Người dùng đang bận',
        message: 'Người được gọi hiện đang trong cuộc gọi khác',
        action: 'Thử lại sau'
      }
    }
  })
  error?: {
    type: string;
    message: string;
    userFriendly: {
      title: string;
      message: string;
      action?: string;
    };
  };
}

export class UserCallStatusResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'User call status data',
    example: {
      userId: 'user123',
      status: 'idle',
      currentCallId: 'call_1704567890_abc123',
      lastActivity: '2025-01-01T12:05:00Z'
    }
  })
  data?: {
    userId: string;
    status: string;
    currentCallId?: string;
    lastActivity?: string;
  };
}

export class HealthCheckResponseDto {
  @ApiProperty({
    description: 'Whether the health check was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'Health check data',
    example: {
      timestamp: '2025-01-01T12:00:00Z',
      services: {
        callState: { status: 'healthy' },
        lifecycle: { status: 'healthy' },
        errorHandler: { status: 'healthy' }
      }
    }
  })
  data?: {
    timestamp: Date;
    services: {
      callState: { status: string };
      lifecycle: { status: string };
      errorHandler: { status: string };
    };
  };
}
