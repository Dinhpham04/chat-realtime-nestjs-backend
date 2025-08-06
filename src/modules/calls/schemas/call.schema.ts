import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Call Schema - Senior Level Implementation
 * Following Senior Guidelines:
 * - Clean Architecture: Separate data model from business logic
 * - Single Responsibility: Manages call session data only
 * - Performance: Optimized indexes for query performance
 * - Security: Input validation via MongoDB schema
 */

export type CallDocument = Call & Document;

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
  GROUP_VOICE = 'group_voice',
  GROUP_VIDEO = 'group_video',
}

export enum CallStatus {
  INITIATING = 'initiating',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed',
}

export enum ParticipantStatus {
  INVITED = 'invited',
  RINGING = 'ringing',
  JOINED = 'joined',
  LEFT = 'left',
  DECLINED = 'declined',
}

export interface CallParticipant {
  userId: string;
  joinedAt?: Date;
  leftAt?: Date;
  status: ParticipantStatus;
  deviceInfo?: {
    platform: string;
    ipAddress: string;
    userAgent?: string;
  };
}

export interface CallQualityMetrics {
  averageLatency: number; // ms
  packetLoss: number; // percentage
  jitter: number; // ms
  audioCodec: string;
  videoCodec?: string;
  maxBitrate: number; // kbps
  minBitrate: number; // kbps
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

@Schema({
  timestamps: true,
  collection: 'calls'
})
export class Call {
  @Prop({
    required: true,
    unique: true,
    index: true
  })
  callId: string; // UUID for call identification

  @Prop({
    required: true,
    enum: Object.values(CallType),
    index: true
  })
  type: CallType;

  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'User',
    index: true
  })
  initiatorId: string; // User who initiated the call

  @Prop({
    type: Types.ObjectId,
    ref: 'Conversation',
    index: true
  })
  conversationId?: string; // For group calls

  @Prop({
    required: true,
    type: [{
      userId: { type: String, required: true },
      joinedAt: { type: Date },
      leftAt: { type: Date },
      status: {
        type: String,
        enum: Object.values(ParticipantStatus),
        default: ParticipantStatus.INVITED
      },
      deviceInfo: {
        platform: { type: String },
        ipAddress: { type: String },
        userAgent: { type: String }
      }
    }]
  })
  participants: CallParticipant[];

  @Prop({
    required: true,
    enum: Object.values(CallStatus),
    default: CallStatus.INITIATING,
    index: true
  })
  status: CallStatus;

  @Prop()
  startedAt?: Date; // When call was actually connected

  @Prop()
  endedAt?: Date; // When call terminated

  @Prop({
    default: 0,
    min: 0
  })
  duration: number; // Duration in seconds

  @Prop({
    enum: ['completed', 'declined', 'missed', 'failed', 'timeout', 'cancelled']
  })
  endReason?: string;

  @Prop({
    type: Object
  })
  qualityMetrics?: CallQualityMetrics;

  @Prop({
    default: false
  })
  isRecorded: boolean;

  @Prop()
  recordingUrl?: string;

  @Prop({
    type: Object
  })
  signalingData?: {
    iceServers?: any[];
    sdpOffer?: any;
    sdpAnswer?: any;
    iceCandidates?: any[];
  };

  // Metadata for analytics
  @Prop({
    type: Object
  })
  analytics?: {
    callAttempts: number;
    reconnections: number;
    networkSwitches: number;
    qualityIssues: string[];
  };
}

export const CallSchema = SchemaFactory.createForClass(Call);

// Indexes for performance optimization
CallSchema.index({ callId: 1 }, { unique: true });
CallSchema.index({ initiatorId: 1, createdAt: -1 }); // Recent calls by user
CallSchema.index({ 'participants.userId': 1, createdAt: -1 }); // Calls involving user
CallSchema.index({ conversationId: 1, createdAt: -1 }); // Group calls
CallSchema.index({ status: 1, createdAt: -1 }); // Active calls
CallSchema.index({ createdAt: -1 }); // Recent calls
CallSchema.index({ endedAt: -1 }, { sparse: true }); // Completed calls

// Virtual for call duration calculation
CallSchema.virtual('calculatedDuration').get(function () {
  if (this.startedAt && this.endedAt) {
    return Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  return 0;
});

// Pre-save middleware to update duration
CallSchema.pre('save', function (next) {
  if (this.startedAt && this.endedAt && this.duration === 0) {
    this.duration = Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  next();
});

// Instance methods
CallSchema.methods.addParticipant = function (userId: string, deviceInfo?: any) {
  const existingParticipant = this.participants.find(p => p.userId === userId);
  if (!existingParticipant) {
    this.participants.push({
      userId,
      status: ParticipantStatus.INVITED,
      deviceInfo
    });
  }
  return this.save();
};

CallSchema.methods.updateParticipantStatus = function (userId: string, status: ParticipantStatus) {
  const participant = this.participants.find(p => p.userId === userId);
  if (participant) {
    participant.status = status;
    if (status === ParticipantStatus.JOINED && !participant.joinedAt) {
      participant.joinedAt = new Date();
    }
    if (status === ParticipantStatus.LEFT && !participant.leftAt) {
      participant.leftAt = new Date();
    }
  }
  return this.save();
};

CallSchema.methods.startCall = function () {
  this.status = CallStatus.ACTIVE;
  this.startedAt = new Date();
  return this.save();
};

CallSchema.methods.endCall = function (reason: string) {
  this.status = CallStatus.ENDED;
  this.endedAt = new Date();
  this.endReason = reason;
  if (this.startedAt) {
    this.duration = Math.floor((this.endedAt.getTime() - this.startedAt.getTime()) / 1000);
  }
  return this.save();
};
