import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { CallType, CallStatus, ParticipantStatus } from '../schemas/call.schema';

/**
 * Call State Service - Senior Level Implementation
 * Following Senior Guidelines:
 * - Single Responsibility: Manages call state in Redis only
 * - Performance: Optimized Redis operations with TTL
 * - Error Handling: Graceful degradation without data leakage
 * - Scalability: Designed for multiple concurrent calls
 */

export interface ActiveCallState {
  callId: string;
  type: CallType;
  status: CallStatus;
  initiatorId: string;
  participants: string[];
  conversationId?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface UserCallStatus {
  userId: string;
  status: 'idle' | 'ringing' | 'in_call' | 'initiating';
  currentCallId?: string;
  lastActivity: Date;
}

export interface CallSignalingData {
  callId: string;
  offerData?: any;
  answerData?: any;
  iceCandidates: any[];
  createdAt: Date;
}

@Injectable()
export class CallStateService {
  private readonly logger = new Logger(CallStateService.name);

  // Redis key patterns
  private readonly KEYS = {
    ACTIVE_CALL: (callId: string) => `call:active:${callId}`,
    USER_CALL_STATUS: (userId: string) => `call:user:${userId}`,
    CALL_SIGNALING: (callId: string) => `call:signal:${callId}`,
    CALL_QUALITY: (callId: string) => `call:quality:${callId}`,
    CALL_PARTICIPANTS: (callId: string) => `call:participants:${callId}`,
    USER_ACTIVE_CALLS: (userId: string) => `call:user_active:${userId}`,
  };

  // TTL constants (in seconds)
  private readonly TTL = {
    ACTIVE_CALL: 3600, // 1 hour
    USER_STATUS: 3600, // 1 hour
    SIGNALING: 300, // 5 minutes
    QUALITY_METRICS: 1800, // 30 minutes
  };

  constructor(@Inject("IOREDIS_CLIENT") private readonly redis: Redis) { }

  /**
   * Create active call state in Redis
   */
  async createActiveCall(callData: Partial<ActiveCallState>): Promise<void> {
    try {
      const callState: ActiveCallState = {
        callId: callData.callId!,
        type: callData.type!,
        status: CallStatus.INITIATING,
        initiatorId: callData.initiatorId!,
        participants: callData.participants || [],
        conversationId: callData.conversationId,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      const key = this.KEYS.ACTIVE_CALL(callState.callId);
      await this.redis.setex(key, this.TTL.ACTIVE_CALL, JSON.stringify(callState));

      // Update user call status
      await this.updateUserCallStatus(callState.initiatorId, 'initiating', callState.callId);

      // Add to user's active calls list
      await this.addUserActiveCall(callState.initiatorId, callState.callId);

      this.logger.log(`Created active call state: ${callState.callId}`);
    } catch (error) {
      this.logger.error(`Failed to create active call state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get active call state
   */
  async getActiveCall(callId: string): Promise<ActiveCallState | null> {
    try {
      const key = this.KEYS.ACTIVE_CALL(callId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to get active call state: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Update call status
   */
  async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    try {
      const callState = await this.getActiveCall(callId);
      if (!callState) {
        this.logger.warn(`Call not found for status update: ${callId}`);
        return;
      }

      callState.status = status;
      callState.lastActivity = new Date();

      const key = this.KEYS.ACTIVE_CALL(callId);
      await this.redis.setex(key, this.TTL.ACTIVE_CALL, JSON.stringify(callState));

      this.logger.log(`Updated call status: ${callId} -> ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update call status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Add participant to call
   */
  async addParticipant(callId: string, userId: string): Promise<void> {
    try {
      const callState = await this.getActiveCall(callId);
      if (!callState) {
        this.logger.warn(`Call not found for participant addition: ${callId}`);
        return;
      }

      if (!callState.participants.includes(userId)) {
        callState.participants.push(userId);
        callState.lastActivity = new Date();

        const key = this.KEYS.ACTIVE_CALL(callId);
        await this.redis.setex(key, this.TTL.ACTIVE_CALL, JSON.stringify(callState));

        // Update participant's call status
        await this.updateUserCallStatus(userId, 'ringing', callId);
        await this.addUserActiveCall(userId, callId);

        this.logger.log(`Added participant to call: ${userId} -> ${callId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to add participant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Remove participant from call
   */
  async removeParticipant(callId: string, userId: string): Promise<void> {
    try {
      const callState = await this.getActiveCall(callId);
      if (!callState) {
        return;
      }

      callState.participants = callState.participants.filter(id => id !== userId);
      callState.lastActivity = new Date();

      const key = this.KEYS.ACTIVE_CALL(callId);
      await this.redis.setex(key, this.TTL.ACTIVE_CALL, JSON.stringify(callState));

      // Update user call status
      await this.updateUserCallStatus(userId, 'idle');
      await this.removeUserActiveCall(userId, callId);

      this.logger.log(`Removed participant from call: ${userId} -> ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to remove participant: ${error.message}`, error.stack);
    }
  }

  /**
   * End active call
   */
  async endCall(callId: string): Promise<void> {
    try {
      const callState = await this.getActiveCall(callId);
      if (!callState) {
        return;
      }

      // Update all participants' status to idle
      await Promise.all(
        callState.participants.map(userId =>
          Promise.all([
            this.updateUserCallStatus(userId, 'idle'),
            this.removeUserActiveCall(userId, callId)
          ])
        )
      );

      // Remove call state
      const key = this.KEYS.ACTIVE_CALL(callId);
      await this.redis.del(key);

      // Clean up signaling data
      await this.cleanupSignalingData(callId);

      this.logger.log(`Ended active call: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to end call: ${error.message}`, error.stack);
    }
  }

  /**
   * Update user call status
   */
  async updateUserCallStatus(
    userId: string,
    status: 'idle' | 'ringing' | 'in_call' | 'initiating',
    callId?: string
  ): Promise<void> {
    try {
      const userStatus: UserCallStatus = {
        userId,
        status,
        currentCallId: status !== 'idle' ? callId : undefined,
        lastActivity: new Date(),
      };

      const key = this.KEYS.USER_CALL_STATUS(userId);

      if (status === 'idle') {
        await this.redis.del(key);
      } else {
        await this.redis.setex(key, this.TTL.USER_STATUS, JSON.stringify(userStatus));
      }

      this.logger.debug(`Updated user call status: ${userId} -> ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update user call status: ${error.message}`, error.stack);
    }
  }

  /**
   * Get user call status
   */
  async getUserCallStatus(userId: string): Promise<UserCallStatus | null> {
    try {
      const key = this.KEYS.USER_CALL_STATUS(userId);
      const data = await this.redis.get(key);

      if (!data) {
        return { userId, status: 'idle', lastActivity: new Date() };
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to get user call status: ${error.message}`, error.stack);
      return { userId, status: 'idle', lastActivity: new Date() };
    }
  }

  /**
   * Store signaling data temporarily
   */
  async storeSignalingData(callId: string, type: 'offer' | 'answer' | 'ice', data: any): Promise<void> {
    try {
      const key = this.KEYS.CALL_SIGNALING(callId);
      let signalingData = await this.getSignalingData(callId);

      if (!signalingData) {
        signalingData = {
          callId,
          iceCandidates: [],
          createdAt: new Date(),
        };
      }

      switch (type) {
        case 'offer':
          signalingData.offerData = data;
          break;
        case 'answer':
          signalingData.answerData = data;
          break;
        case 'ice':
          signalingData.iceCandidates.push(data);
          break;
      }

      await this.redis.setex(key, this.TTL.SIGNALING, JSON.stringify(signalingData));
      this.logger.debug(`Stored ${type} signaling data for call: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to store signaling data: ${error.message}`, error.stack);
    }
  }

  /**
   * Get signaling data
   */
  async getSignalingData(callId: string): Promise<CallSignalingData | null> {
    try {
      const key = this.KEYS.CALL_SIGNALING(callId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Failed to get signaling data: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Cleanup signaling data
   */
  async cleanupSignalingData(callId: string): Promise<void> {
    try {
      const key = this.KEYS.CALL_SIGNALING(callId);
      await this.redis.del(key);

      const qualityKey = this.KEYS.CALL_QUALITY(callId);
      await this.redis.del(qualityKey);

      this.logger.debug(`Cleaned up signaling data for call: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup signaling data: ${error.message}`, error.stack);
    }
  }

  /**
   * Add user to active calls list
   */
  private async addUserActiveCall(userId: string, callId: string): Promise<void> {
    try {
      const key = this.KEYS.USER_ACTIVE_CALLS(userId);
      await this.redis.sadd(key, callId);
      await this.redis.expire(key, this.TTL.USER_STATUS);
    } catch (error) {
      this.logger.error(`Failed to add user active call: ${error.message}`, error.stack);
    }
  }

  /**
   * Remove user from active calls list
   */
  private async removeUserActiveCall(userId: string, callId: string): Promise<void> {
    try {
      const key = this.KEYS.USER_ACTIVE_CALLS(userId);
      await this.redis.srem(key, callId);
    } catch (error) {
      this.logger.error(`Failed to remove user active call: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all active calls for user
   */
  async getUserActiveCalls(userId: string): Promise<string[]> {
    try {
      const key = this.KEYS.USER_ACTIVE_CALLS(userId);
      return await this.redis.smembers(key);
    } catch (error) {
      this.logger.error(`Failed to get user active calls: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Cleanup call state - remove all Redis keys for a call
   */
  async cleanupCall(callId: string): Promise<void> {
    try {
      const keysToDelete = [
        this.KEYS.ACTIVE_CALL(callId),
        this.KEYS.CALL_SIGNALING(callId),
        this.KEYS.CALL_QUALITY(callId),
        this.KEYS.CALL_PARTICIPANTS(callId),
      ];

      // Delete all call-related keys
      await this.redis.del(...keysToDelete);

      // Clean up user active calls lists
      const activeCall = await this.getActiveCall(callId);
      if (activeCall?.participants) {
        for (const userId of activeCall.participants) {
          await this.removeUserActiveCall(userId, callId);

          // Reset user call status if this was their current call
          const userStatus = await this.getUserCallStatus(userId);
          if (userStatus?.currentCallId === callId) {
            await this.updateUserCallStatus(userId, 'idle');
          }
        }
      }

      this.logger.log(`Cleaned up call state: ${callId}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup call state: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Health check for call state service
   */
  async healthCheck(): Promise<{ status: string; activeCallsCount?: number }> {
    try {
      // Test Redis connection
      await this.redis.ping();

      // Count active calls (approximate)
      const keys = await this.redis.keys('call:active:*');

      return {
        status: 'healthy',
        activeCallsCount: keys.length
      };
    } catch (error) {
      this.logger.error(`Call state service health check failed: ${error.message}`, error.stack);
      return { status: 'unhealthy' };
    }
  }
}
