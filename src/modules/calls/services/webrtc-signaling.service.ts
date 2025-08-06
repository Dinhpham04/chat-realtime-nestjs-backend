import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';

import { Call, CallDocument, CallStatus } from '../schemas/call.schema';
import { CallStateService } from './call-state.service';
import {
  CallInitiateDto,
  CallAcceptDto,
  CallDeclineDto,
  CallHangupDto,
  CallIceCandidateDto,
  CallRenegotiateDto,
  CallMediaStateDto,
  CallType,
  SessionDescriptionDto
} from '../dto/webrtc-signaling.dto';

/**
 * WebRTC Signaling Service
 * 
 * Handles the business logic for WebRTC signaling operations:
 * - SDP Offer/Answer exchange
 * - ICE candidate management
 * - Call lifecycle management
 * - Call state persistence
 * 
 * Following Clean Architecture principles with separation of concerns
 */
@Injectable()
export class WebRTCSignalingService {
  private readonly logger = new Logger(WebRTCSignalingService.name);

  constructor(
    @InjectModel(Call.name) private callModel: Model<CallDocument>,
    private readonly callStateService: CallStateService,
    @Inject('IOREDIS_CLIENT') private readonly redis: Redis
  ) { }

  /**
   * Initiate a new call with SDP offer
   * Creates call record và stores signaling data
   */
  async initiateCall(
    callerId: string,
    initiateData: CallInitiateDto
  ): Promise<{
    callId: string;
    callRecord: CallDocument;
    signalingData: any;
  }> {
    try {
      this.logger.debug(`Initiating ${initiateData.callType} call from ${callerId} to ${initiateData.targetUserId}`);

      // Validate that target user exists và is available
      await this.validateCallParticipants(callerId, initiateData.targetUserId);

      // Check if users are already in calls
      await this.validateUserCallAvailability(callerId, initiateData.targetUserId);

      // Generate unique call ID
      const callId = this.generateCallId();

      // Create call record in MongoDB
      const callRecord = await this.createCallRecord(callId, callerId, initiateData);

      // Store signaling data in Redis for real-time access
      const signalingData = await this.storeSignalingData(callId, {
        callerId,
        targetUserId: initiateData.targetUserId,
        callType: initiateData.callType,
        sdpOffer: initiateData.sdpOffer,
        status: 'initiating',
        createdAt: new Date()
      });

      // Update user call states
      await this.callStateService.updateUserCallStatus(callerId, 'initiating', callId);
      await this.callStateService.updateUserCallStatus(initiateData.targetUserId, 'ringing', callId);

      // Set call as active in Redis
      await this.callStateService.createActiveCall({
        callId,
        type: initiateData.callType,
        initiatorId: callerId,
        participants: [callerId, initiateData.targetUserId],
        conversationId: initiateData.conversationId
      });

      this.logger.log(`Call initiated successfully: ${callId}`);

      return {
        callId,
        callRecord,
        signalingData
      };

    } catch (error) {
      this.logger.error(`Failed to initiate call: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Accept incoming call with SDP answer
   * Updates call status và enables media exchange
   */
  async acceptCall(
    userId: string,
    acceptData: CallAcceptDto
  ): Promise<{
    callRecord: CallDocument;
    signalingData: any;
  }> {
    try {
      this.logger.debug(`User ${userId} accepting call ${acceptData.callId}`);

      // Validate call exists và user is participant
      const callRecord = await this.validateCallParticipation(acceptData.callId, userId);

      // Check call is still in valid state for acceptance
      if (callRecord.status !== 'initiating') {
        throw new BadRequestException(`Call ${acceptData.callId} is not in initiating state`);
      }

      // Update call record
      const updatedCall = await this.callModel.findByIdAndUpdate(
        callRecord._id,
        {
          status: 'active',
          startedAt: new Date(),
          $set: {
            'participants.$[elem].status': 'joined',
            'participants.$[elem].joinedAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.userId': userId }],
          new: true
        }
      );

      // Store SDP answer in signaling data
      const signalingData = await this.updateSignalingData(acceptData.callId, {
        sdpAnswer: acceptData.sdpAnswer,
        status: 'active',
        acceptedAt: new Date(),
        acceptedBy: userId
      });

      // Update user call states
      await this.callStateService.updateUserCallStatus(callRecord.initiatorId, 'in_call', acceptData.callId);
      await this.callStateService.updateUserCallStatus(userId, 'in_call', acceptData.callId);

      // Update active call state
      await this.callStateService.updateCallStatus(acceptData.callId, CallStatus.ACTIVE);

      this.logger.log(`Call accepted successfully: ${acceptData.callId}`);

      return {
        callRecord: updatedCall!,
        signalingData
      };

    } catch (error) {
      this.logger.error(`Failed to accept call: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to accept call: ${error.message}`);
    }
  }

  /**
   * Decline incoming call
   * Updates call status và cleans up resources
   */
  async declineCall(
    userId: string,
    declineData: CallDeclineDto
  ): Promise<{
    callRecord: CallDocument;
  }> {
    try {
      this.logger.debug(`User ${userId} declining call ${declineData.callId}`);

      // Validate call exists và user is participant
      const callRecord = await this.validateCallParticipation(declineData.callId, userId);

      // Update call record
      const updatedCall = await this.callModel.findByIdAndUpdate(
        callRecord._id,
        {
          status: 'ended',
          endedAt: new Date(),
          endReason: 'declined',
          $set: {
            'participants.$[elem].status': 'declined',
            'participants.$[elem].leftAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.userId': userId }],
          new: true
        }
      );

      // Clean up call state
      await this.cleanupCallState(declineData.callId, 'declined');

      this.logger.log(`Call declined successfully: ${declineData.callId}`);

      return {
        callRecord: updatedCall!
      };

    } catch (error) {
      this.logger.error(`Failed to decline call: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to decline call: ${error.message}`);
    }
  }

  /**
   * Hangup active call
   * Ends call session và cleans up all resources
   */
  async hangupCall(
    userId: string,
    hangupData: CallHangupDto
  ): Promise<{
    callRecord: CallDocument;
  }> {
    try {
      this.logger.debug(`User ${userId} hanging up call ${hangupData.callId}`);

      // Validate call exists và user is participant
      const callRecord = await this.validateCallParticipation(hangupData.callId, userId);

      // Calculate call duration
      const duration = callRecord.startedAt
        ? Math.floor((new Date().getTime() - callRecord.startedAt.getTime()) / 1000)
        : 0;

      // Update call record
      const updatedCall = await this.callModel.findByIdAndUpdate(
        callRecord._id,
        {
          status: 'ended',
          endedAt: new Date(),
          duration,
          endReason: hangupData.reason || 'completed',
          $set: {
            'participants.$[elem].status': 'left',
            'participants.$[elem].leftAt': new Date()
          }
        },
        {
          arrayFilters: [{ 'elem.userId': userId }],
          new: true
        }
      );

      // Clean up call state
      await this.cleanupCallState(hangupData.callId, 'completed');

      this.logger.log(`Call ended successfully: ${hangupData.callId}, duration: ${duration}s`);

      return {
        callRecord: updatedCall!
      };

    } catch (error) {
      this.logger.error(`Failed to hangup call: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to hangup call: ${error.message}`);
    }
  }

  /**
   * Handle ICE candidate exchange
   * Stores ICE candidates for WebRTC connectivity
   */
  async handleIceCandidate(
    userId: string,
    candidateData: CallIceCandidateDto
  ): Promise<void> {
    try {
      this.logger.debug(`Handling ICE candidate for call ${candidateData.callId} from user ${userId}`);

      // Validate callId parameter
      if (!candidateData.callId) {
        throw new BadRequestException('Call ID is required');
      }

      // Validate call exists và user is participant
      // Use try-catch to handle the case where call might have been cleaned up
      try {
        await this.validateCallParticipation(candidateData.callId, userId);
      } catch (error) {
        if (error.message.includes('not found')) {
          // Log warning but don't throw - call might have ended/timeout
          this.logger.warn(`ICE candidate for ended/non-existent call ${candidateData.callId} from user ${userId} - ignoring`);
          return; // Gracefully ignore ICE candidates for ended calls
        }
        // Re-throw other validation errors
        throw error;
      }

      // Store ICE candidate in Redis with short TTL
      await this.storeIceCandidate(candidateData.callId, userId, candidateData.candidate);

      this.logger.debug(`ICE candidate stored for call ${candidateData.callId}`);

    } catch (error) {
      this.logger.error(`Failed to handle ICE candidate: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to handle ICE candidate: ${error.message}`);
    }
  }

  /**
   * Handle call renegotiation (e.g., adding video)
   * Updates SDP offers for mid-call changes
   */
  async handleRenegotiation(
    userId: string,
    renegotiateData: CallRenegotiateDto
  ): Promise<{
    signalingData: any;
  }> {
    try {
      this.logger.debug(`Handling renegotiation for call ${renegotiateData.callId} by user ${userId}`);

      // Validate call exists và user is participant
      await this.validateCallParticipation(renegotiateData.callId, userId);

      // Update signaling data with new SDP offer
      const signalingData = await this.updateSignalingData(renegotiateData.callId, {
        renegotiationOffer: renegotiateData.sdpOffer,
        renegotiationReason: renegotiateData.reason,
        renegotiationBy: userId,
        renegotiationAt: new Date()
      });

      this.logger.log(`Call renegotiation handled: ${renegotiateData.callId}`);

      return {
        signalingData
      };

    } catch (error) {
      this.logger.error(`Failed to handle renegotiation: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to handle renegotiation: ${error.message}`);
    }
  }

  /**
   * Update media state (mute/unmute, video on/off)
   * Tracks media state changes for call quality
   */
  async updateMediaState(
    userId: string,
    mediaData: CallMediaStateDto
  ): Promise<void> {
    try {
      this.logger.debug(`Updating media state for call ${mediaData.callId} by user ${userId}`);

      // Validate call exists và user is participant
      await this.validateCallParticipation(mediaData.callId, userId);

      // Update media state in Redis
      await this.updateCallMediaState(mediaData.callId, userId, {
        audioEnabled: mediaData.audioEnabled,
        videoEnabled: mediaData.videoEnabled,
        screenSharingEnabled: mediaData.screenSharingEnabled,
        updatedAt: new Date()
      });

      this.logger.debug(`Media state updated for call ${mediaData.callId}`);

    } catch (error) {
      this.logger.error(`Failed to update media state: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to update media state: ${error.message}`);
    }
  }

  /**
   * Get signaling data for call
   * Retrieves current SDP và ICE data for WebRTC connection
   */
  async getSignalingData(callId: string): Promise<any> {
    try {
      const signalingKey = `call:signaling:${callId}`;
      const data = await this.redis.get(signalingKey);

      if (!data) {
        throw new NotFoundException(`Signaling data not found for call ${callId}`);
      }

      return JSON.parse(data);

    } catch (error) {
      this.logger.error(`Failed to get signaling data: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods

  private async validateCallParticipants(callerId: string, targetUserId: string): Promise<void> {
    // TODO: Validate users exist in database
    // TODO: Check if users are friends/allowed to call each other
    if (callerId === targetUserId) {
      throw new BadRequestException('Cannot call yourself');
    }
  }

  private async validateUserCallAvailability(callerId: string, targetUserId: string): Promise<void> {
    const callerStatus = await this.callStateService.getUserCallStatus(callerId);
    const targetStatus = await this.callStateService.getUserCallStatus(targetUserId);

    if (callerStatus && callerStatus.status !== 'idle') {
      throw new BadRequestException('Caller is already in a call');
    }

    if (targetStatus && targetStatus.status !== 'idle') {
      throw new BadRequestException('Target user is busy');
    }
  }

  private async validateCallParticipation(callId: string, userId: string): Promise<CallDocument> {
    // Add validation for callId parameter
    if (!callId) {
      this.logger.error(`validateCallParticipation: callId is null or undefined for user ${userId}`);
      throw new BadRequestException('Call ID is required');
    }

    this.logger.debug(`Validating call participation: callId=${callId}, userId=${userId}`);

    const callRecord = await this.callModel.findOne({
      callId,
      'participants.userId': userId
    }).exec();

    this.logger.debug(`Call record found:`, callRecord ? {
      callId: callRecord.callId,
      status: callRecord.status,
      participants: callRecord.participants?.map(p => p.userId)
    } : null);

    if (!callRecord) {
      throw new NotFoundException(`Call ${callId} not found or user not participant`);
    }

    return callRecord;
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async createCallRecord(
    callId: string,
    callerId: string,
    initiateData: CallInitiateDto
  ): Promise<CallDocument> {
    const participants = [
      {
        userId: callerId,
        status: 'joined',
        joinedAt: new Date()
      },
      {
        userId: initiateData.targetUserId,
        status: 'invited'
      }
    ];

    const callRecord = new this.callModel({
      callId,
      type: initiateData.callType,
      initiatorId: callerId,
      conversationId: initiateData.conversationId,
      participants,
      status: 'initiating'
    });

    return await callRecord.save();
  }

  private async storeSignalingData(callId: string, data: any): Promise<any> {
    const signalingKey = `call:signaling:${callId}`;
    const ttl = 3600; // 1 hour TTL

    await this.redis.setex(signalingKey, ttl, JSON.stringify(data));
    return data;
  }

  private async updateSignalingData(callId: string, updates: any): Promise<any> {
    const signalingKey = `call:signaling:${callId}`;
    const existingData = await this.redis.get(signalingKey);

    if (!existingData) {
      throw new NotFoundException(`Signaling data not found for call ${callId}`);
    }

    const updatedData = {
      ...JSON.parse(existingData),
      ...updates,
      updatedAt: new Date()
    };

    await this.redis.setex(signalingKey, 3600, JSON.stringify(updatedData));
    return updatedData;
  }

  private async storeIceCandidate(callId: string, userId: string, candidate: any): Promise<void> {
    const candidateKey = `call:ice:${callId}:${userId}`;
    const ttl = 300; // 5 minutes TTL for ICE candidates

    // Store as a list to handle multiple candidates
    await this.redis.lpush(candidateKey, JSON.stringify({
      candidate,
      timestamp: new Date(),
      userId
    }));

    await this.redis.expire(candidateKey, ttl);
  }

  private async updateCallMediaState(callId: string, userId: string, mediaState: any): Promise<void> {
    const mediaKey = `call:media:${callId}:${userId}`;
    const ttl = 3600; // 1 hour TTL

    await this.redis.setex(mediaKey, ttl, JSON.stringify(mediaState));
  }

  private async cleanupCallState(callId: string, reason: string): Promise<void> {
    this.logger.debug(`Cleaning up call state for ${callId}, reason: ${reason}`);

    // Get call participants before cleanup
    const activeCall = await this.callStateService.getActiveCall(callId);

    if (activeCall && activeCall.participants) {
      // Reset user call statuses
      for (const participantId of activeCall.participants) {
        await this.callStateService.updateUserCallStatus(participantId, 'idle');
      }
    }

    // Remove active call
    await this.callStateService.endCall(callId);

    // Clean up signaling data
    const signalingKey = `call:signaling:${callId}`;
    await this.redis.del(signalingKey);

    // Clean up ICE candidates (pattern-based deletion)
    const iceKeys = await this.redis.keys(`call:ice:${callId}:*`);
    if (iceKeys.length > 0) {
      await this.redis.del(...iceKeys);
    }

    // Clean up media state
    const mediaKeys = await this.redis.keys(`call:media:${callId}:*`);
    if (mediaKeys.length > 0) {
      await this.redis.del(...mediaKeys);
    }

    this.logger.debug(`Call state cleanup completed for ${callId}`);
  }
}
