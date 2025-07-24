/**
 * Message Service Custom Exceptions
 * 
 * 🎯 Purpose: Comprehensive error handling for message operations
 * 📱 Mobile-First: Proper error codes for client handling
 * 🚀 Clean Architecture: Layered error handling with context
 * 
 * Design Principles:
 * - Single Responsibility: Each error type has specific purpose
 * - DRY: Reusable error patterns with proper inheritance
 * - Security: No sensitive data exposure in error messages
 * - User Experience: Clear error messages for client display
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base Message Service Error
 */
export abstract class MessageServiceError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(
      {
        message,
        code,
        timestamp: new Date().toISOString(),
        context: context || {}
      },
      status
    );
  }
}

/**
 * Message Not Found Error
 */
export class MessageNotFoundError extends MessageServiceError {
  constructor(messageId: string) {
    super(
      'Message not found',
      HttpStatus.NOT_FOUND,
      'MESSAGE_NOT_FOUND',
      { messageId }
    );
  }
}

/**
 * Unauthorized Message Access Error
 */
export class MessageUnauthorizedError extends MessageServiceError {
  constructor(operation: string, messageId?: string) {
    super(
      `Unauthorized to ${operation} message`,
      HttpStatus.FORBIDDEN,
      'MESSAGE_UNAUTHORIZED',
      { operation, messageId }
    );
  }
}

/**
 * Invalid Message Content Error
 */
export class InvalidMessageContentError extends MessageServiceError {
  constructor(reason: string, messageType?: string) {
    super(
      `Invalid message content: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'INVALID_MESSAGE_CONTENT',
      { reason, messageType }
    );
  }
}

/**
 * Message Validation Error
 */
export class MessageValidationError extends MessageServiceError {
  constructor(field: string, reason: string, value?: any) {
    super(
      `Validation failed for ${field}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'MESSAGE_VALIDATION_ERROR',
      { field, reason, value }
    );
  }
}

/**
 * Conversation Access Error
 */
export class ConversationAccessError extends MessageServiceError {
  constructor(conversationId: string, userId: string) {
    super(
      'User is not a member of this conversation',
      HttpStatus.FORBIDDEN,
      'CONVERSATION_ACCESS_DENIED',
      { conversationId, userId }
    );
  }
}

/**
 * Message Edit Not Allowed Error
 */
export class MessageEditNotAllowedError extends MessageServiceError {
  constructor(reason: string, messageId?: string) {
    super(
      `Message edit not allowed: ${reason}`,
      HttpStatus.BAD_REQUEST,
      'MESSAGE_EDIT_NOT_ALLOWED',
      { reason, messageId }
    );
  }
}

/**
 * Message Already Deleted Error
 */
export class MessageAlreadyDeletedError extends MessageServiceError {
  constructor(messageId: string) {
    super(
      'Message has already been deleted',
      HttpStatus.GONE,
      'MESSAGE_ALREADY_DELETED',
      { messageId }
    );
  }
}

/**
 * Rate Limit Exceeded Error
 */
export class MessageRateLimitError extends MessageServiceError {
  constructor(limit: number, timeWindow: string) {
    super(
      `Message rate limit exceeded: ${limit} messages per ${timeWindow}`,
      HttpStatus.TOO_MANY_REQUESTS,
      'MESSAGE_RATE_LIMIT_EXCEEDED',
      { limit, timeWindow }
    );
  }
}

/**
 * Message Size Limit Error
 */
export class MessageSizeLimitError extends MessageServiceError {
  constructor(currentSize: number, maxSize: number) {
    super(
      `Message size exceeds limit: ${currentSize} bytes (max: ${maxSize} bytes)`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      'MESSAGE_SIZE_LIMIT_EXCEEDED',
      { currentSize, maxSize }
    );
  }
}

/**
 * Service Unavailable Error
 */
export class MessageServiceUnavailableError extends MessageServiceError {
  constructor(service: string, reason?: string) {
    super(
      `Message service temporarily unavailable: ${service}${reason ? ` (${reason})` : ''}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      'MESSAGE_SERVICE_UNAVAILABLE',
      { service, reason }
    );
  }
}
