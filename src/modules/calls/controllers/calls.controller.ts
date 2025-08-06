import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  SetMetadata
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { CallLifecycleService } from '../services/call-lifecycle.service';
import { CallStateService } from '../services/call-state.service';
import { CallErrorHandlerService, CallErrorType } from '../services/call-error-handler.service';
import { CallType, CallStatus } from '../schemas/call.schema';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtUser } from '../../auth/interfaces/jwt-payload.interface';
import { Public } from 'src/shared';
import {
  InitiateCallDto,
  CallResponseDto,
  UserCallStatusResponseDto,
  HealthCheckResponseDto
} from '../dto';

/**
 * Call Controller - Senior Level Implementation
 * Following Senior Guidelines:
 * - Clean Architecture: Controller only handles HTTP concerns
 * - Error Handling: Proper HTTP status codes and error messages
 * - Security: JWT authentication and authorization
 * - Documentation: Comprehensive Swagger documentation
 * - Validation: Input validation via DTOs
 */

interface CallResponse {
  success: boolean;
  data?: any;
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

@ApiTags('calls')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  private readonly logger = new Logger(CallsController.name);

  constructor(
    private readonly callLifecycleService: CallLifecycleService,
    private readonly callStateService: CallStateService,
    private readonly callErrorHandler: CallErrorHandlerService,
  ) { }

  /**
   * Initiate a new call
   */
  @Post('initiate')
  @ApiOperation({
    summary: 'Initiate a new voice or video call',
    description: 'Creates a new call session and sends invitation to target user(s)'
  })
  @ApiBody({
    type: InitiateCallDto,
    description: 'Call initiation details',
    examples: {
      voiceCall: {
        summary: 'Voice Call Example',
        description: 'Example of initiating a voice call',
        value: {
          targetUserId: 'user456',
          callType: 'voice'
        }
      },
      videoCall: {
        summary: 'Video Call Example',
        description: 'Example of initiating a video call',
        value: {
          targetUserId: 'user456',
          callType: 'video'
        }
      },
      groupCall: {
        summary: 'Group Call Example',
        description: 'Example of initiating a group call',
        value: {
          targetUserId: 'user456',
          callType: 'voice',
          conversationId: 'conv_123456'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Call initiated successfully',
    type: CallResponseDto,
    examples: {
      success: {
        summary: 'Successful call initiation',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'ringing',
            type: 'voice',
            targetUserId: 'user456'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or user busy',
    type: CallResponseDto,
    examples: {
      userBusy: {
        summary: 'Target user is busy',
        value: {
          success: false,
          error: {
            type: 'user_busy',
            message: 'Target user is currently in another call',
            userFriendly: {
              title: 'Người dùng đang bận',
              message: 'Người được gọi hiện đang trong cuộc gọi khác',
              action: 'Thử lại sau'
            }
          }
        }
      },
      callingSelf: {
        summary: 'User trying to call themselves',
        value: {
          success: false,
          error: {
            type: 'invalid_call_state',
            message: 'Cannot call yourself',
            userFriendly: {
              title: 'Không thể tự gọi',
              message: 'Bạn không thể gọi cho chính mình',
              action: 'Chọn người khác để gọi'
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async initiateCall(
    @Body() initiateRequest: InitiateCallDto,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      this.logger.log(`User ${user.userId} initiating ${initiateRequest.callType} call to ${initiateRequest.targetUserId}`);

      // Validate input
      if (!initiateRequest.targetUserId || !initiateRequest.callType) {
        throw new BadRequestException('Target user ID and call type are required');
      }

      // Check if user is calling themselves
      if (initiateRequest.targetUserId === user.userId) {
        const error = await this.callErrorHandler.handleCallError(
          CallErrorType.INVALID_CALL_STATE,
          '',
          undefined,
          { reason: 'calling_self' },
          user.userId
        );
        return { success: false, error: this.formatError(error) };
      }

      // Check if initiator is already in a call
      const initiatorStatus = await this.callStateService.getUserCallStatus(user.userId);
      if (initiatorStatus?.status !== 'idle') {
        const error = await this.callErrorHandler.handleCallError(
          CallErrorType.USER_BUSY,
          '',
          undefined,
          { userStatus: initiatorStatus?.status },
          user.userId
        );
        return { success: false, error: this.formatError(error) };
      }

      // Check if target user is available
      const targetStatus = await this.callStateService.getUserCallStatus(initiateRequest.targetUserId);
      if (targetStatus?.status !== 'idle') {
        const error = await this.callErrorHandler.handleCallError(
          CallErrorType.USER_BUSY,
          '',
          undefined,
          { targetUserId: initiateRequest.targetUserId, targetStatus: targetStatus?.status }
        );
        return { success: false, error: this.formatError(error) };
      }

      // Generate unique call ID
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Initiate call lifecycle
      await this.callLifecycleService.initiateCall(
        callId,
        initiateRequest.callType,
        user.userId,
        [initiateRequest.targetUserId],
        initiateRequest.conversationId
      );

      this.logger.log(`Call initiated successfully: ${callId}`);

      return {
        success: true,
        data: {
          callId,
          status: CallStatus.RINGING,
          type: initiateRequest.callType,
          targetUserId: initiateRequest.targetUserId,
        }
      };

    } catch (error) {
      this.logger.error(`Failed to initiate call: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        '',
        error,
        { action: 'initiate_call', userId: user.userId },
        user.userId
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Accept an incoming call
   */
  @Patch(':callId/accept')
  @ApiOperation({
    summary: 'Accept an incoming call',
    description: 'Accepts a call invitation and transitions call to connecting state'
  })
  @ApiParam({
    name: 'callId',
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Call accepted successfully',
    type: CallResponseDto,
    examples: {
      success: {
        summary: 'Call accepted successfully',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'connecting',
            message: 'Call accepted, establishing connection...'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found',
    type: CallResponseDto,
    examples: {
      notFound: {
        summary: 'Call not found',
        value: {
          success: false,
          error: {
            type: 'not_found',
            message: 'Call not found',
            userFriendly: {
              title: 'Cuộc gọi không tồn tại',
              message: 'Cuộc gọi này không còn khả dụng'
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid call state',
    type: CallResponseDto,
    examples: {
      invalidState: {
        summary: 'Invalid call state',
        value: {
          success: false,
          error: {
            type: 'invalid_call_state',
            message: 'Call is not in ringing state',
            userFriendly: {
              title: 'Trạng thái cuộc gọi không hợp lệ',
              message: 'Cuộc gọi này không thể chấp nhận được'
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User not authorized for this call'
  })
  async acceptCall(
    @Param('callId') callId: string,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      this.logger.log(`User ${user.userId} accepting call: ${callId}`);

      // Validate call exists
      const callState = await this.callStateService.getActiveCall(callId);
      if (!callState) {
        throw new NotFoundException(`Call not found: ${callId}`);
      }

      // Validate user is participant
      if (!callState.participants.includes(user.userId)) {
        const error = await this.callErrorHandler.handleCallError(
          CallErrorType.UNAUTHORIZED_CALL,
          callId,
          undefined,
          { userId: user.userId, participants: callState.participants }
        );
        return { success: false, error: this.formatError(error) };
      }

      // Validate call state
      if (callState.status !== CallStatus.RINGING) {
        const error = await this.callErrorHandler.handleCallError(
          CallErrorType.INVALID_CALL_STATE,
          callId,
          undefined,
          { currentStatus: callState.status, expectedStatus: CallStatus.RINGING }
        );
        return { success: false, error: this.formatError(error) };
      }

      // Accept call
      await this.callLifecycleService.acceptCall(callId, user.userId);

      this.logger.log(`Call accepted successfully: ${callId}`);

      return {
        success: true,
        data: {
          callId,
          status: CallStatus.CONNECTING,
          message: 'Call accepted, establishing connection...'
        }
      };

    } catch (error) {
      this.logger.error(`Failed to accept call: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        callId,
        error,
        { action: 'accept_call', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Decline an incoming call
   */
  @Patch(':callId/decline')
  @ApiOperation({
    summary: 'Decline an incoming call',
    description: 'Declines a call invitation and ends the call'
  })
  @ApiParam({
    name: 'callId',
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Call declined successfully',
    type: CallResponseDto,
    examples: {
      success: {
        summary: 'Call declined successfully',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'ended',
            message: 'Call declined'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found'
  })
  async declineCall(
    @Param('callId') callId: string,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      this.logger.log(`User ${user.userId} declining call: ${callId}`);

      await this.callLifecycleService.declineCall(callId, user.userId);

      return {
        success: true,
        data: {
          callId,
          status: CallStatus.ENDED,
          message: 'Call declined'
        }
      };

    } catch (error) {
      this.logger.error(`Failed to decline call: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        callId,
        error,
        { action: 'decline_call', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Hangup/End a call
   */
  @Patch(':callId/hangup')
  @ApiOperation({
    summary: 'End an active call',
    description: 'Ends an active call and cleans up resources'
  })
  @ApiParam({
    name: 'callId',
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Call ended successfully',
    type: CallResponseDto,
    examples: {
      success: {
        summary: 'Call ended successfully',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'ended',
            message: 'Call ended'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found'
  })
  async hangupCall(
    @Param('callId') callId: string,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      this.logger.log(`User ${user.userId} hanging up call: ${callId}`);

      await this.callLifecycleService.endCall(callId, 'user_hangup', user.userId);

      return {
        success: true,
        data: {
          callId,
          status: CallStatus.ENDED,
          message: 'Call ended'
        }
      };

    } catch (error) {
      this.logger.error(`Failed to hangup call: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        callId,
        error,
        { action: 'hangup_call', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Get user's current call status
   */
  @Get('user/status')
  @ApiOperation({
    summary: 'Get current user call status',
    description: 'Retrieves current call status for the authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'User call status retrieved successfully',
    type: UserCallStatusResponseDto,
    examples: {
      idle: {
        summary: 'User is idle',
        value: {
          success: true,
          data: {
            userId: 'user123',
            status: 'idle',
            currentCallId: null,
            lastActivity: '2025-01-01T12:00:00Z'
          }
        }
      },
      inCall: {
        summary: 'User is in a call',
        value: {
          success: true,
          data: {
            userId: 'user123',
            status: 'in_call',
            currentCallId: 'call_1704567890_abc123',
            lastActivity: '2025-01-01T12:05:00Z'
          }
        }
      },
      ringing: {
        summary: 'User has incoming call',
        value: {
          success: true,
          data: {
            userId: 'user123',
            status: 'ringing',
            currentCallId: 'call_1704567890_abc123',
            lastActivity: '2025-01-01T12:03:00Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  async getUserCallStatus(@CurrentUser() user: JwtUser): Promise<CallResponse> {
    try {

      this.logger.log(`Getting call status for user: ${user.userId}`);
      const userStatus = await this.callStateService.getUserCallStatus(user.userId);

      return {
        success: true,
        data: {
          userId: user.userId,
          status: userStatus?.status || 'idle',
          currentCallId: userStatus?.currentCallId,
          lastActivity: userStatus?.lastActivity,
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get user call status: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        '',
        error,
        { action: 'get_user_status', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Get call status
   */
  @Get(':callId/status')
  @ApiOperation({
    summary: 'Get current call status',
    description: 'Retrieves current status and details of a call'
  })
  @ApiParam({
    name: 'callId',
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Call status retrieved successfully',
    type: CallResponseDto,
    examples: {
      ringing: {
        summary: 'Call is ringing',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'ringing',
            type: 'voice',
            participants: ['user123', 'user456'],
            createdAt: '2025-01-01T12:00:00Z',
            lastActivity: '2025-01-01T12:00:30Z'
          }
        }
      },
      active: {
        summary: 'Call is active',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'active',
            type: 'video',
            participants: ['user123', 'user456'],
            createdAt: '2025-01-01T12:00:00Z',
            lastActivity: '2025-01-01T12:05:00Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found',
    type: CallResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User not authorized to access this call'
  })
  async getCallStatus(
    @Param('callId') callId: string,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      const callState = await this.callStateService.getActiveCall(callId);

      if (!callState) {
        throw new NotFoundException(`Call not found: ${callId}`);
      }

      // Verify user has access to this call
      if (!callState.participants.includes(user.userId)) {
        throw new ForbiddenException('Access denied to this call');
      }

      return {
        success: true,
        data: {
          callId: callState.callId,
          status: callState.status,
          type: callState.type,
          participants: callState.participants,
          createdAt: callState.createdAt,
          lastActivity: callState.lastActivity,
        }
      };

    } catch (error) {
      this.logger.error(`Failed to get call status: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.SERVER_ERROR,
        callId,
        error,
        { action: 'get_call_status', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Mark WebRTC connection as established
   */
  @Patch(':callId/connected')
  @ApiOperation({
    summary: 'Mark call as connected',
    description: 'Called when WebRTC connection is successfully established'
  })
  @ApiParam({
    name: 'callId',
    description: 'Unique call identifier',
    example: 'call_1704567890_abc123',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Call marked as connected',
    type: CallResponseDto,
    examples: {
      success: {
        summary: 'Call connection established',
        value: {
          success: true,
          data: {
            callId: 'call_1704567890_abc123',
            status: 'active',
            message: 'Call connection established'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token'
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found'
  })
  async markCallConnected(
    @Param('callId') callId: string,
    @CurrentUser() user: JwtUser
  ): Promise<CallResponse> {
    try {
      this.logger.log(`Marking call as connected: ${callId} by user ${user.userId}`);

      await this.callLifecycleService.establishConnection(callId);

      return {
        success: true,
        data: {
          callId,
          status: CallStatus.ACTIVE,
          message: 'Call connection established'
        }
      };

    } catch (error) {
      this.logger.error(`Failed to mark call as connected: ${error.message}`, error.stack);

      const callError = await this.callErrorHandler.handleCallError(
        CallErrorType.WEBRTC_CONNECTION_LOST,
        callId,
        error,
        { action: 'mark_connected', userId: user.userId }
      );

      return { success: false, error: this.formatError(callError) };
    }
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Call service health check',
    description: 'Checks health of call-related services. This endpoint does not require authentication.'
  })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    type: HealthCheckResponseDto,
    examples: {
      healthy: {
        summary: 'All services healthy',
        value: {
          success: true,
          data: {
            timestamp: '2025-01-01T12:00:00Z',
            services: {
              callState: { status: 'healthy' },
              lifecycle: { status: 'healthy' },
              errorHandler: { status: 'healthy' }
            }
          }
        }
      },
      unhealthy: {
        summary: 'Some services unhealthy',
        value: {
          success: false,
          error: {
            type: 'health_check_failed',
            message: 'Service health check failed',
            userFriendly: {
              title: 'Lỗi hệ thống',
              message: 'Không thể kiểm tra trạng thái hệ thống'
            }
          }
        }
      }
    }
  })
  async healthCheck(): Promise<CallResponse> {
    try {
      const callStateHealth = await this.callStateService.healthCheck();

      return {
        success: true,
        data: {
          timestamp: new Date(),
          services: {
            callState: callStateHealth,
            lifecycle: { status: 'healthy' },
            errorHandler: { status: 'healthy' },
          }
        }
      };

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      return {
        success: false,
        error: {
          type: 'health_check_failed',
          message: 'Service health check failed',
          userFriendly: {
            title: 'Lỗi hệ thống',
            message: 'Không thể kiểm tra trạng thái hệ thống'
          }
        }
      };
    }
  }

  /**
   * Helper method to format error response
   */
  private formatError(callError: any): any {
    return {
      type: callError.type,
      message: callError.message,
      userFriendly: callError.userFriendly,
    };
  }
}
