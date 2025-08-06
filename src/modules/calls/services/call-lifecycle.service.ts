import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CallStateService } from './call-state.service';
import { CallErrorHandlerService, CallErrorType } from './call-error-handler.service';
import { Call, CallDocument, CallStatus, CallType, ParticipantStatus } from '../schemas/call.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Call Lifecycle Service - Senior Level Implementation
 * Following Senior Guidelines:
 * - Single Responsibility: Manages call state transitions and timeouts
 * - Clean Architecture: Separates lifecycle logic from signaling
 * - Error Handling: Graceful degradation with proper error propagation
 * - Performance: Efficient timeout management with cleanup
 */

export interface CallLifecycleOptions {
  ringingTimeout?: number; // milliseconds
  connectingTimeout?: number;
  maxCallDuration?: number;
}

export interface CallTransitionEvent {
  callId: string;
  fromStatus: CallStatus;
  toStatus: CallStatus;
  timestamp: Date;
  userId?: string;
  reason?: string;
}

@Injectable()
export class CallLifecycleService {
  private readonly logger = new Logger(CallLifecycleService.name);

  // Timeout configurations (milliseconds)
  private readonly TIMEOUTS = {
    RINGING: 30000, // 30 seconds for user to answer
    CONNECTING: 15000, // 15 seconds to establish connection
    MAX_CALL_DURATION: 3600000, // 1 hour max call
    CLEANUP_DELAY: 5000, // 5 seconds before cleanup
  };

  // Active timeouts for cleanup
  private readonly activeTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    private readonly callStateService: CallStateService,
    private readonly callErrorHandler: CallErrorHandlerService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  /**
   * Initiate call lifecycle - từ initiating → ringing
   */
  async initiateCall(
    callId: string,
    callType: CallType,
    initiatorId: string,
    targetUserIds: string[],
    conversationId?: string,
    options?: CallLifecycleOptions,
  ): Promise<void> {
    try {
      this.logger.log(`Initiating call lifecycle: ${callId}`);

      // Create call record trong MongoDB => replace to use repository 
      const callRecord = new this.callModel({
        callId,
        type: callType,
        initiatorId,
        conversationId,
        participants: [
          {
            userId: initiatorId,
            status: ParticipantStatus.JOINED,
            joinedAt: new Date(),
          },
          ...targetUserIds.map(userId => ({
            userId,
            status: ParticipantStatus.INVITED,
          })),
        ],
        status: CallStatus.INITIATING,
      });

      await callRecord.save();

      // Create active call state trong Redis
      await this.callStateService.createActiveCall({
        callId,
        type: callType,
        status: CallStatus.INITIATING,
        initiatorId,
        participants: [initiatorId, ...targetUserIds],
        conversationId,
      });

      // Transition to RINGING status
      await this.transitionToRinging(callId, options);

      this.logger.log(`Call lifecycle initiated successfully: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to initiate call lifecycle: ${error.message}`, error.stack);

      // Handle error với CallErrorHandlerService
      await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        callId,
        error,
        { action: 'initiate_call', initiatorId, targetUserIds },
        initiatorId
      );

      await this.handleCallFailure(callId, 'initialization_failed');
      throw error;
    }
  }

  /**
   * Transition call to RINGING status với timeout
   */
  private async transitionToRinging(callId: string, options?: CallLifecycleOptions): Promise<void> {
    try {
      await this.updateCallStatus(callId, CallStatus.RINGING);

      // Set ringing timeout
      const ringingTimeout = options?.ringingTimeout || this.TIMEOUTS.RINGING;
      const timeoutId = setTimeout(() => {
        this.handleRingingTimeout(callId);
      }, ringingTimeout);

      this.activeTimeouts.set(`${callId}:ringing`, timeoutId);

      this.logger.log(`Call transitioned to RINGING: ${callId}, timeout: ${ringingTimeout}ms`);
    } catch (error) {
      this.logger.error(`Failed to transition to ringing: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle user accepting call - ringing → connecting → active
   */
  async acceptCall(callId: string, userId: string): Promise<void> {
    try {
      this.logger.log(`User ${userId} accepting call: ${callId}`);

      // Clear ringing timeout
      this.clearTimeout(`${callId}:ringing`);

      // Update participant status
      await this.updateParticipantStatus(callId, userId, ParticipantStatus.JOINED);

      // Transition to CONNECTING
      await this.transitionToConnecting(callId);

      this.logger.log(`Call accepted by user ${userId}: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to accept call: ${error.message}`, error.stack);
      await this.handleCallFailure(callId, 'accept_failed');
      throw error;
    }
  }

  /**
   * Transition to CONNECTING status với timeout
   */
  private async transitionToConnecting(callId: string): Promise<void> {
    try {
      await this.updateCallStatus(callId, CallStatus.CONNECTING);

      // Set connecting timeout
      const timeoutId = setTimeout(() => {
        this.handleConnectingTimeout(callId);
      }, this.TIMEOUTS.CONNECTING);

      this.activeTimeouts.set(`${callId}:connecting`, timeoutId);

      this.logger.log(`Call transitioned to CONNECTING: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to transition to connecting: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * WebRTC connection established - connecting → active
   */
  async establishConnection(callId: string): Promise<void> {
    try {
      this.logger.log(`Establishing WebRTC connection: ${callId}`);

      // Clear connecting timeout
      this.clearTimeout(`${callId}:connecting`);

      // Transition to ACTIVE
      await this.updateCallStatus(callId, CallStatus.ACTIVE);

      // Update call started time
      await this.callModel.updateOne(
        { callId },
        {
          startedAt: new Date(),
          $inc: { __v: 1 }
        }
      );

      // Set max duration timeout
      const timeoutId = setTimeout(() => {
        this.handleMaxDurationTimeout(callId);
      }, this.TIMEOUTS.MAX_CALL_DURATION);

      this.activeTimeouts.set(`${callId}:max_duration`, timeoutId);

      // Emit call established event
      this.eventEmitter.emit('call.established', { callId, timestamp: new Date() });

      this.logger.log(`Call connection established: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to establish connection: ${error.message}`, error.stack);
      await this.handleCallFailure(callId, 'connection_failed');
      throw error;
    }
  }

  /**
   * Handle call declining
   */
  async declineCall(callId: string, userId: string, reason?: string): Promise<void> {
    try {
      this.logger.log(`User ${userId} declining call: ${callId}`);

      // Update participant status
      await this.updateParticipantStatus(callId, userId, ParticipantStatus.DECLINED);

      // End call với reason
      await this.endCall(callId, 'declined', userId);

      this.logger.log(`Call declined by user ${userId}: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to decline call: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle call hangup/end
   */
  async endCall(callId: string, reason: string, userId?: string): Promise<void> {
    try {
      this.logger.log(`Ending call: ${callId}, reason: ${reason}`);

      // Clear all timeouts
      this.clearAllTimeouts(callId);

      // Update call record
      const endedAt = new Date();
      const callRecord = await this.callModel.findOne({ callId });

      if (callRecord) {
        const duration = callRecord.startedAt
          ? Math.floor((endedAt.getTime() - callRecord.startedAt.getTime()) / 1000)
          : 0;

        await this.callModel.updateOne(
          { callId },
          {
            status: CallStatus.ENDED,
            endedAt,
            duration,
            endReason: reason,
            $inc: { __v: 1 }
          }
        );
      }

      // Update call state trong Redis
      await this.updateCallStatus(callId, CallStatus.ENDED);

      // Update participant status if user initiated hangup
      if (userId) {
        await this.updateParticipantStatus(callId, userId, ParticipantStatus.LEFT);
      }

      // Schedule cleanup
      setTimeout(() => {
        this.cleanupCall(callId);
      }, this.TIMEOUTS.CLEANUP_DELAY);

      // Emit call ended event
      this.eventEmitter.emit('call.ended', {
        callId,
        reason,
        userId,
        timestamp: endedAt
      });

      this.logger.log(`Call ended successfully: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to end call: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle call failure
   */
  async handleCallFailure(callId: string, reason: string): Promise<void> {
    try {
      this.logger.warn(`Call failure: ${callId}, reason: ${reason}`);

      // Clear all timeouts
      this.clearAllTimeouts(callId);

      // Update call status
      await this.updateCallStatus(callId, CallStatus.FAILED);

      // Update call record
      await this.callModel.updateOne(
        { callId },
        {
          status: CallStatus.FAILED,
          endedAt: new Date(),
          endReason: reason,
          $inc: { __v: 1 }
        }
      );

      // Emit call failed event
      this.eventEmitter.emit('call.failed', {
        callId,
        reason,
        timestamp: new Date()
      });

      // Schedule cleanup
      setTimeout(() => {
        this.cleanupCall(callId);
      }, this.TIMEOUTS.CLEANUP_DELAY);

      this.logger.log(`Call failure handled: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to handle call failure: ${error.message}`, error.stack);
    }
  }

  /**
   * Timeout handlers với proper error handling
   */
  private async handleRingingTimeout(callId: string): Promise<void> {
    this.logger.warn(`Call ringing timeout: ${callId}`);

    // Handle timeout error
    await this.callErrorHandler.handleCallError(
      CallErrorType.TIMEOUT_RINGING,
      callId,
      undefined,
      { timeout: this.TIMEOUTS.RINGING }
    );

    await this.handleCallFailure(callId, 'timeout');
  }

  private async handleConnectingTimeout(callId: string): Promise<void> {
    this.logger.warn(`Call connecting timeout: ${callId}`);

    // Handle connecting timeout
    await this.callErrorHandler.handleCallError(
      CallErrorType.TIMEOUT_CONNECTING,
      callId,
      undefined,
      { timeout: this.TIMEOUTS.CONNECTING }
    );

    await this.handleCallFailure(callId, 'connection_timeout');
  }

  private async handleMaxDurationTimeout(callId: string): Promise<void> {
    this.logger.warn(`Call max duration reached: ${callId}`);

    // Handle max duration error
    await this.callErrorHandler.handleCallError(
      CallErrorType.MAX_DURATION_EXCEEDED,
      callId,
      undefined,
      { maxDuration: this.TIMEOUTS.MAX_CALL_DURATION }
    );

    await this.endCall(callId, 'max_duration_reached');
  }

  /**
   * Update call status trong MongoDB và Redis
   */
  private async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    try {
      // Update MongoDB
      await this.callModel.updateOne(
        { callId },
        {
          status,
          $inc: { __v: 1 }
        }
      );

      // Update Redis
      await this.callStateService.updateCallStatus(callId, status);

      // Emit status change event
      this.eventEmitter.emit('call.status_changed', {
        callId,
        status,
        timestamp: new Date()
      });

      this.logger.debug(`Call status updated: ${callId} → ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update call status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update participant status
   */
  private async updateParticipantStatus(
    callId: string,
    userId: string,
    status: ParticipantStatus
  ): Promise<void> {
    try {
      await this.callModel.updateOne(
        {
          callId,
          'participants.userId': userId
        },
        {
          $set: {
            'participants.$.status': status,
            'participants.$.joinedAt': status === ParticipantStatus.JOINED ? new Date() : undefined,
            'participants.$.leftAt': status === ParticipantStatus.LEFT ? new Date() : undefined,
          },
          $inc: { __v: 1 }
        }
      );

      this.logger.debug(`Participant status updated: ${userId} → ${status} trong call ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to update participant status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Timeout management
   */
  private clearTimeout(key: string): void {
    const timeoutId = this.activeTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.activeTimeouts.delete(key);
      this.logger.debug(`Cleared timeout: ${key}`);
    }
  }

  private clearAllTimeouts(callId: string): void {
    const keys = Array.from(this.activeTimeouts.keys()).filter(key => key.startsWith(callId));
    keys.forEach(key => this.clearTimeout(key));
    this.logger.debug(`Cleared all timeouts for call: ${callId}`);
  }

  /**
   * Cleanup call resources
   */
  private async cleanupCall(callId: string): Promise<void> {
    try {
      this.logger.log(`Cleaning up call resources: ${callId}`);

      // Clear any remaining timeouts
      this.clearAllTimeouts(callId);

      // Cleanup Redis state
      await this.callStateService.cleanupCall(callId);

      this.logger.log(`Call cleanup completed: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup call: ${error.message}`, error.stack);
    }
  }

  /**
   * Get call status for monitoring
   */
  async getCallStatus(callId: string): Promise<CallStatus | null> {
    try {
      const callRecord = await this.callModel.findOne({ callId }, 'status');
      return callRecord?.status || null;
    } catch (error) {
      this.logger.error(`Failed to get call status: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Health check - cleanup any orphaned timeouts
   */
  async healthCheck(): Promise<void> {
    try {
      const activeTimeoutCount = this.activeTimeouts.size;

      if (activeTimeoutCount > 100) { // Alert if too many timeouts
        this.logger.warn(`High number of active timeouts: ${activeTimeoutCount}`);
      }

      this.logger.debug(`Health check: ${activeTimeoutCount} active timeouts`);
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
    }
  }
}
