import { IsString, IsEnum, IsOptional, IsObject, IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallType } from '../schemas/call.schema';

/**
 * Call DTOs - Senior Level Implementation
 * Following Senior Guidelines:
 * - Input Validation: Proper validation for all inputs
 * - API Documentation: Complete Swagger documentation
 * - Type Safety: Strong typing for all data transfer
 * - Security: Prevent injection attacks via validation
 */

export class CallInitiateDto {
  @ApiProperty({
    description: 'Target user ID to call',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  targetUserId: string;

  @ApiProperty({
    description: 'Type of call to initiate',
    enum: CallType,
    example: CallType.VOICE
  })
  @IsEnum(CallType)
  type: CallType;

  @ApiPropertyOptional({
    description: 'Conversation ID for group calls',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'SDP offer for WebRTC negotiation'
  })
  @IsOptional()
  @IsObject()
  sdpOffer?: RTCSessionDescriptionInit;

  @ApiPropertyOptional({
    description: 'Device information'
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: {
    platform: string;
    userAgent?: string;
  };
}

export class CallAcceptDto {
  @ApiProperty({
    description: 'Call ID to accept',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiPropertyOptional({
    description: 'SDP answer for WebRTC negotiation'
  })
  @IsOptional()
  @IsObject()
  sdpAnswer?: RTCSessionDescriptionInit;

  @ApiPropertyOptional({
    description: 'Device information'
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: {
    platform: string;
    userAgent?: string;
  };
}

export class CallDeclineDto {
  @ApiProperty({
    description: 'Call ID to decline',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiPropertyOptional({
    description: 'Reason for declining the call',
    example: 'busy'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CallHangupDto {
  @ApiProperty({
    description: 'Call ID to hangup',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiPropertyOptional({
    description: 'Reason for hanging up',
    example: 'completed'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class IceCandidateDto {
  @ApiProperty({
    description: 'Call ID for ICE candidate exchange',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiProperty({
    description: 'ICE candidate data'
  })
  @IsObject()
  candidate: RTCIceCandidateInit;
}

export class CallOfferDto {
  @ApiProperty({
    description: 'Call ID',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiProperty({
    description: 'Caller user ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  callerId: string;

  @ApiProperty({
    description: 'Target user ID',
    example: '507f1f77bcf86cd799439012'
  })
  @IsString()
  targetUserId: string;

  @ApiProperty({
    description: 'Call type',
    enum: CallType
  })
  @IsEnum(CallType)
  callType: CallType;

  @ApiProperty({
    description: 'SDP offer for WebRTC'
  })
  @IsObject()
  sdpOffer: RTCSessionDescriptionInit;

  @ApiPropertyOptional({
    description: 'Conversation ID for group calls'
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class CallAnswerDto {
  @ApiProperty({
    description: 'Call ID',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiProperty({
    description: 'SDP answer for WebRTC'
  })
  @IsObject()
  sdpAnswer: RTCSessionDescriptionInit;

  @ApiProperty({
    description: 'User ID who answered',
    example: '507f1f77bcf86cd799439012'
  })
  @IsString()
  userId: string;
}

export class CallQualityUpdateDto {
  @ApiProperty({
    description: 'Call ID',
    example: 'call-uuid-12345'
  })
  @IsString()
  callId: string;

  @ApiProperty({
    description: 'Quality metrics'
  })
  @IsObject()
  qualityMetrics: {
    latency?: number;
    packetLoss?: number;
    jitter?: number;
    connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

// Response DTOs
export class CallStateDto {
  @ApiProperty()
  callId: string;

  @ApiProperty({ enum: CallType })
  type: CallType;

  @ApiProperty()
  initiatorId: string;

  @ApiProperty()
  participants: Array<{
    userId: string;
    status: string;
    joinedAt?: Date;
  }>;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  startedAt?: Date;

  @ApiProperty()
  duration: number;
}

export class CallHistoryDto {
  @ApiProperty()
  callId: string;

  @ApiProperty({ enum: CallType })
  type: CallType;

  @ApiProperty()
  initiatorId: string;

  @ApiProperty()
  participants: string[];

  @ApiProperty()
  status: string;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  endReason?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  endedAt?: Date;
}
