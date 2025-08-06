import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateNested,
  IsArray,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Call Types supported by the system
 */
export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
  GROUP_VOICE = 'group_voice',
  GROUP_VIDEO = 'group_video'
}

/**
 * SDP Types for WebRTC negotiation
 */
export enum SDPType {
  OFFER = 'offer',
  ANSWER = 'answer'
}

/**
 * ICE Candidate Type definition
 */
export class IceCandidateDto {
  @ApiProperty({ description: 'ICE candidate string' })
  @IsString()
  @IsNotEmpty()
  candidate: string;

  @ApiProperty({ description: 'SDP media line index' })
  @IsOptional()
  sdpMLineIndex?: number;

  @ApiProperty({ description: 'SDP media ID' })
  @IsOptional()
  @IsString()
  sdpMid?: string;

  @ApiProperty({ description: 'Username fragment' })
  @IsOptional()
  @IsString()
  usernameFragment?: string;
}

/**
 * SDP Session Description
 */
export class SessionDescriptionDto {
  @ApiProperty({
    description: 'SDP type',
    enum: SDPType,
    example: SDPType.OFFER
  })
  @IsEnum(SDPType)
  type: SDPType;

  @ApiProperty({ description: 'SDP content' })
  @IsString()
  @IsNotEmpty()
  sdp: string;
}

/**
 * Call Initiation Request
 * Used when a user starts a new call
 */
export class CallInitiateDto {
  @ApiProperty({
    description: 'Target user ID to call',
    example: '507f1f77bcf86cd799439011'
  })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiProperty({
    description: 'Type of call to initiate',
    enum: CallType,
    example: CallType.VIDEO
  })
  @IsEnum(CallType)
  callType: CallType;

  @ApiProperty({
    description: 'SDP offer for WebRTC connection',
    type: SessionDescriptionDto
  })
  @ValidateNested()
  @Type(() => SessionDescriptionDto)
  sdpOffer: SessionDescriptionDto;

  @ApiProperty({
    description: 'Optional conversation ID for group calls',
    required: false
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({
    description: 'Additional metadata for the call',
    required: false
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Call Accept Response
 * Used when a user accepts an incoming call
 */
export class CallAcceptDto {
  @ApiProperty({
    description: 'Call session ID',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'SDP answer for WebRTC connection',
    type: SessionDescriptionDto
  })
  @ValidateNested()
  @Type(() => SessionDescriptionDto)
  sdpAnswer: SessionDescriptionDto;

  @ApiProperty({
    description: 'Media constraints for the call',
    required: false
  })
  @IsOptional()
  @IsObject()
  mediaConstraints?: {
    audio: boolean;
    video: boolean;
  };
}

/**
 * Call Decline Request
 * Used when a user declines an incoming call
 */
export class CallDeclineDto {
  @ApiProperty({
    description: 'Call session ID to decline',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'Reason for declining the call',
    required: false,
    example: 'busy'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Call Hangup Request
 * Used when a user ends an active call
 */
export class CallHangupDto {
  @ApiProperty({
    description: 'Call session ID to end',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'Reason for hanging up',
    required: false,
    example: 'completed'
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * ICE Candidate Exchange
 * Used for WebRTC connectivity negotiation
 */
export class CallIceCandidateDto {
  @ApiProperty({
    description: 'Call session ID',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'ICE candidate data',
    type: IceCandidateDto
  })
  @ValidateNested()
  @Type(() => IceCandidateDto)
  candidate: IceCandidateDto;

  @ApiProperty({
    description: 'Candidate source (local/remote)',
    required: false
  })
  @IsOptional()
  @IsString()
  source?: string;
}

/**
 * Call Renegotiation Request
 * Used for mid-call changes (e.g., adding video to voice call)
 */
export class CallRenegotiateDto {
  @ApiProperty({
    description: 'Call session ID',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'New SDP offer for renegotiation',
    type: SessionDescriptionDto
  })
  @ValidateNested()
  @Type(() => SessionDescriptionDto)
  sdpOffer: SessionDescriptionDto;

  @ApiProperty({
    description: 'Reason for renegotiation',
    example: 'enable_video'
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/**
 * Media State Update
 * Used for controlling media during calls (mute/unmute, video on/off)
 */
export class CallMediaStateDto {
  @ApiProperty({
    description: 'Call session ID',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'Audio state (enabled/disabled)',
    required: false
  })
  @IsOptional()
  @IsBoolean()
  audioEnabled?: boolean;

  @ApiProperty({
    description: 'Video state (enabled/disabled)',
    required: false
  })
  @IsOptional()
  @IsBoolean()
  videoEnabled?: boolean;

  @ApiProperty({
    description: 'Screen sharing state',
    required: false
  })
  @IsOptional()
  @IsBoolean()
  screenSharingEnabled?: boolean;

  @ApiProperty({
    description: 'Additional media metadata',
    required: false
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * Group Call Participant Management
 */
export class GroupCallParticipantDto {
  @ApiProperty({
    description: 'Call session ID',
    example: 'call_670a1c2d8e9f012345678901'
  })
  @IsString()
  @IsNotEmpty()
  callId: string;

  @ApiProperty({
    description: 'Participant user IDs',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  participantIds: string[];

  @ApiProperty({
    description: 'Action to perform (invite/remove)',
    example: 'invite'
  })
  @IsString()
  @IsNotEmpty()
  action: 'invite' | 'remove';
}
