import { Injectable, Logger } from '@nestjs/common';
import { CallStatus } from '../schemas/call.schema';

/**
 * Call Error Handler Service - Senior Level Implementation
 * Following Senior Guidelines:
 * - Single Responsibility: Handles all call-related errors
 * - Error Handling: Graceful degradation without data leakage
 * - Security: Sanitize error messages before client response
 * - Monitoring: Comprehensive error logging for debugging
 */

export enum CallErrorType {
  // Network errors
  NETWORK_CONNECTION_FAILED = 'network_connection_failed',
  ICE_CONNECTION_FAILED = 'ice_connection_failed',
  SIGNALING_TIMEOUT = 'signaling_timeout',

  // Permission errors
  MEDIA_PERMISSION_DENIED = 'media_permission_denied',
  CAMERA_NOT_AVAILABLE = 'camera_not_available',
  MICROPHONE_NOT_AVAILABLE = 'microphone_not_available',

  // User errors
  USER_BUSY = 'user_busy',
  USER_OFFLINE = 'user_offline',
  USER_DECLINED = 'user_declined',
  CALL_CANCELLED = 'call_cancelled',

  // System errors
  TIMEOUT_RINGING = 'timeout_ringing',
  TIMEOUT_CONNECTING = 'timeout_connecting',
  MAX_DURATION_EXCEEDED = 'max_duration_exceeded',
  SERVER_ERROR = 'server_error',
  INVALID_CALL_STATE = 'invalid_call_state',

  // WebRTC errors
  WEBRTC_OFFER_FAILED = 'webrtc_offer_failed',
  WEBRTC_ANSWER_FAILED = 'webrtc_answer_failed',
  WEBRTC_CONNECTION_LOST = 'webrtc_connection_lost',

  // Security errors
  UNAUTHORIZED_CALL = 'unauthorized_call',
  CALL_LIMIT_EXCEEDED = 'call_limit_exceeded',
}

export interface CallError {
  type: CallErrorType;
  message: string;
  callId: string;
  userId?: string;
  timestamp: Date;
  technical?: {
    originalError?: Error;
    stackTrace?: string;
    context?: Record<string, any>;
  };
  userFriendly: {
    title: string;
    message: string;
    action?: string;
  };
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'abort' | 'redirect';
  action: string;
  maxRetries?: number;
  retryDelay?: number;
}

@Injectable()
export class CallErrorHandlerService {
  private readonly logger = new Logger(CallErrorHandlerService.name);

  // Error retry configurations
  private readonly RETRY_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000, // 2 seconds
    EXPONENTIAL_BACKOFF: true,
  };

  /**
   * Handle call error với proper logging và user-friendly messages
   */
  async handleCallError(
    errorType: CallErrorType,
    callId: string,
    originalError?: Error,
    context?: Record<string, any>,
    userId?: string
  ): Promise<CallError> {
    const timestamp = new Date();

    try {
      const callError: CallError = {
        type: errorType,
        message: this.getErrorMessage(errorType),
        callId,
        userId,
        timestamp,
        technical: {
          originalError,
          stackTrace: originalError?.stack,
          context,
        },
        userFriendly: this.getUserFriendlyError(errorType),
      };

      // Log error với appropriate level
      this.logError(callError);

      // Emit error event for monitoring
      this.emitErrorEvent(callError);

      return callError;
    } catch (error) {
      this.logger.error('Failed to handle call error:', error);
      return this.createFallbackError(callId, userId);
    }
  }

  /**
   * Get recovery action for error type
   */
  getRecoveryAction(errorType: CallErrorType): ErrorRecoveryAction | null {
    const recoveryMap: Partial<Record<CallErrorType, ErrorRecoveryAction>> = {
      [CallErrorType.NETWORK_CONNECTION_FAILED]: {
        type: 'retry',
        action: 'retry_connection',
        maxRetries: 3,
        retryDelay: 2000,
      },
      [CallErrorType.ICE_CONNECTION_FAILED]: {
        type: 'retry',
        action: 'retry_ice_connection',
        maxRetries: 2,
        retryDelay: 1000,
      },
      [CallErrorType.SIGNALING_TIMEOUT]: {
        type: 'retry',
        action: 'retry_signaling',
        maxRetries: 2,
        retryDelay: 1500,
      },
      [CallErrorType.MEDIA_PERMISSION_DENIED]: {
        type: 'redirect',
        action: 'request_permissions',
      },
      [CallErrorType.USER_BUSY]: {
        type: 'fallback',
        action: 'send_message',
      },
      [CallErrorType.USER_OFFLINE]: {
        type: 'fallback',
        action: 'send_message',
      },
      [CallErrorType.TIMEOUT_RINGING]: {
        type: 'fallback',
        action: 'send_missed_call_notification',
      },
      [CallErrorType.WEBRTC_CONNECTION_LOST]: {
        type: 'retry',
        action: 'reconnect_call',
        maxRetries: 2,
        retryDelay: 1000,
      },
      [CallErrorType.SERVER_ERROR]: {
        type: 'retry',
        action: 'retry_server_connection',
        maxRetries: 1,
        retryDelay: 3000,
      },
      [CallErrorType.UNAUTHORIZED_CALL]: {
        type: 'abort',
        action: 'show_unauthorized_message',
      },
      [CallErrorType.CALL_LIMIT_EXCEEDED]: {
        type: 'abort',
        action: 'show_limit_exceeded_message',
      },
    };

    return recoveryMap[errorType] || null;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(errorType: CallErrorType): boolean {
    const recoverableErrors = [
      CallErrorType.NETWORK_CONNECTION_FAILED,
      CallErrorType.ICE_CONNECTION_FAILED,
      CallErrorType.SIGNALING_TIMEOUT,
      CallErrorType.WEBRTC_CONNECTION_LOST,
      CallErrorType.SERVER_ERROR,
    ];

    return recoverableErrors.includes(errorType);
  }

  /**
   * Get timeout configuration for call states
   */
  getTimeoutConfig(callStatus: CallStatus): { timeout: number; errorType: CallErrorType } | null {
    const timeoutMap: Partial<Record<CallStatus, { timeout: number; errorType: CallErrorType }>> = {
      [CallStatus.RINGING]: {
        timeout: 30000, // 30 seconds
        errorType: CallErrorType.TIMEOUT_RINGING,
      },
      [CallStatus.CONNECTING]: {
        timeout: 15000, // 15 seconds
        errorType: CallErrorType.TIMEOUT_CONNECTING,
      },
      [CallStatus.ACTIVE]: {
        timeout: 3600000, // 1 hour
        errorType: CallErrorType.MAX_DURATION_EXCEEDED,
      },
      [CallStatus.INITIATING]: {
        timeout: 10000, // 10 seconds
        errorType: CallErrorType.SIGNALING_TIMEOUT,
      },
    };

    return timeoutMap[callStatus] || null;
  }

  /**
   * Validate call state transition
   */
  validateStateTransition(currentStatus: CallStatus, targetStatus: CallStatus): boolean {
    const validTransitions: Record<CallStatus, CallStatus[]> = {
      [CallStatus.INITIATING]: [CallStatus.RINGING, CallStatus.FAILED, CallStatus.ENDED],
      [CallStatus.RINGING]: [CallStatus.CONNECTING, CallStatus.FAILED, CallStatus.ENDED],
      [CallStatus.CONNECTING]: [CallStatus.ACTIVE, CallStatus.FAILED, CallStatus.ENDED],
      [CallStatus.ACTIVE]: [CallStatus.ENDED, CallStatus.FAILED],
      [CallStatus.ENDED]: [], // Terminal state
      [CallStatus.FAILED]: [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  }

  /**
   * Private helper methods
   */
  private getErrorMessage(errorType: CallErrorType): string {
    const errorMessages: Record<CallErrorType, string> = {
      [CallErrorType.NETWORK_CONNECTION_FAILED]: 'Network connection failed during call setup',
      [CallErrorType.ICE_CONNECTION_FAILED]: 'Failed to establish peer-to-peer connection',
      [CallErrorType.SIGNALING_TIMEOUT]: 'Call signaling timed out',
      [CallErrorType.MEDIA_PERMISSION_DENIED]: 'Camera or microphone permission denied',
      [CallErrorType.CAMERA_NOT_AVAILABLE]: 'Camera device not available',
      [CallErrorType.MICROPHONE_NOT_AVAILABLE]: 'Microphone device not available',
      [CallErrorType.USER_BUSY]: 'User is currently in another call',
      [CallErrorType.USER_OFFLINE]: 'User is not available for calls',
      [CallErrorType.USER_DECLINED]: 'User declined the call',
      [CallErrorType.CALL_CANCELLED]: 'Call was cancelled by initiator',
      [CallErrorType.TIMEOUT_RINGING]: 'Call timed out while ringing',
      [CallErrorType.TIMEOUT_CONNECTING]: 'Call timed out while connecting',
      [CallErrorType.MAX_DURATION_EXCEEDED]: 'Maximum call duration exceeded',
      [CallErrorType.SERVER_ERROR]: 'Server error occurred during call',
      [CallErrorType.INVALID_CALL_STATE]: 'Invalid call state transition',
      [CallErrorType.WEBRTC_OFFER_FAILED]: 'Failed to create WebRTC offer',
      [CallErrorType.WEBRTC_ANSWER_FAILED]: 'Failed to create WebRTC answer',
      [CallErrorType.WEBRTC_CONNECTION_LOST]: 'WebRTC connection lost during call',
      [CallErrorType.UNAUTHORIZED_CALL]: 'Unauthorized to make this call',
      [CallErrorType.CALL_LIMIT_EXCEEDED]: 'Call limit exceeded for user',
    };

    return errorMessages[errorType] || 'Unknown call error occurred';
  }

  private getUserFriendlyError(errorType: CallErrorType): { title: string; message: string; action?: string } {
    const userFriendlyMap: Partial<Record<CallErrorType, { title: string; message: string; action?: string }>> = {
      [CallErrorType.NETWORK_CONNECTION_FAILED]: {
        title: 'Kết nối mạng thất bại',
        message: 'Không thể kết nối đến người dùng khác. Vui lòng kiểm tra kết nối mạng.',
        action: 'Thử lại',
      },
      [CallErrorType.ICE_CONNECTION_FAILED]: {
        title: 'Không thể kết nối',
        message: 'Không thể thiết lập kết nối trực tiếp. Có thể do firewall hoặc NAT.',
        action: 'Thử lại',
      },
      [CallErrorType.MEDIA_PERMISSION_DENIED]: {
        title: 'Cần quyền truy cập',
        message: 'Ứng dụng cần quyền sử dụng camera và microphone để thực hiện cuộc gọi.',
        action: 'Cấp quyền',
      },
      [CallErrorType.USER_BUSY]: {
        title: 'Người dùng đang bận',
        message: 'Người dùng hiện đang trong cuộc gọi khác.',
        action: 'Gửi tin nhắn',
      },
      [CallErrorType.USER_OFFLINE]: {
        title: 'Người dùng không trực tuyến',
        message: 'Người dùng hiện không có sẵn để nhận cuộc gọi.',
        action: 'Gửi tin nhắn',
      },
      [CallErrorType.TIMEOUT_RINGING]: {
        title: 'Không có phản hồi',
        message: 'Người dùng không trả lời cuộc gọi.',
        action: 'Thử lại sau',
      },
      [CallErrorType.WEBRTC_CONNECTION_LOST]: {
        title: 'Mất kết nối',
        message: 'Kết nối cuộc gọi bị gián đoạn.',
        action: 'Gọi lại',
      },
      [CallErrorType.SERVER_ERROR]: {
        title: 'Lỗi hệ thống',
        message: 'Có lỗi xảy ra với hệ thống. Vui lòng thử lại sau.',
        action: 'Thử lại',
      },
      [CallErrorType.UNAUTHORIZED_CALL]: {
        title: 'Không được phép',
        message: 'Bạn không có quyền thực hiện cuộc gọi này.',
      },
    };

    return userFriendlyMap[errorType] || {
      title: 'Lỗi cuộc gọi',
      message: 'Có lỗi xảy ra trong cuộc gọi.',
      action: 'Thử lại',
    };
  }

  private logError(callError: CallError): void {
    const logContext = {
      callId: callError.callId,
      userId: callError.userId,
      errorType: callError.type,
      timestamp: callError.timestamp,
      context: callError.technical?.context,
    };

    // Log with appropriate level based on error severity
    switch (callError.type) {
      case CallErrorType.SERVER_ERROR:
      case CallErrorType.UNAUTHORIZED_CALL:
        this.logger.error(callError.message, callError.technical?.stackTrace, logContext);
        break;

      case CallErrorType.NETWORK_CONNECTION_FAILED:
      case CallErrorType.ICE_CONNECTION_FAILED:
      case CallErrorType.WEBRTC_CONNECTION_LOST:
        this.logger.warn(callError.message, logContext);
        break;

      default:
        this.logger.log(callError.message, logContext);
        break;
    }
  }

  private emitErrorEvent(callError: CallError): void {
    // Emit event for monitoring/analytics (to be implemented with EventEmitter2)
    // this.eventEmitter.emit('call.error', callError);

    // For now, just log the event
    this.logger.debug(`Call error event emitted: ${callError.type} for call ${callError.callId}`);
  }

  private createFallbackError(callId: string, userId?: string): CallError {
    return {
      type: CallErrorType.SERVER_ERROR,
      message: 'Unexpected error occurred during call error handling',
      callId,
      userId,
      timestamp: new Date(),
      userFriendly: {
        title: 'Lỗi hệ thống',
        message: 'Có lỗi không mong muốn xảy ra. Vui lòng thử lại.',
        action: 'Thử lại',
      },
    };
  }
}
