import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from '../dto';
import { AuthResponse } from '../interfaces/auth.interfaces';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  RegisterApiDocs,
  LoginApiDocs,
  RefreshTokenApiDocs,
  LogoutApiDocs,
  LogoutAllApiDocs,
  GetProfileApiDocs,
  HealthCheckApiDocs,
} from '../documentation/auth.swagger';

/**
 * Authentication Controller - Enterprise Level
 * 
 * Following instruction-senior.md:
 * - Complete API documentation with OpenAPI/Swagger
 * - Request/response examples
 * - Error codes and messages
 * - Authentication requirements
 * - Security documentation
 */
@ApiTags('Authentication')
@Controller('auth')
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) { }

  /**
   * Register new user
   * 
   * Creates a new user account with phone number and password.
   * Following Senior Guidelines:
   * - Complete input validation
   * - Detailed error responses
   * - Security audit logging
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RegisterApiDocs()
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    this.logger.log(`Registration attempt for phone: ${registerDto.phoneNumber}`);

    const result = await this.authService.register({
      phoneNumber: registerDto.phoneNumber,
      fullName: registerDto.fullName,
      password: registerDto.password,
      confirmPassword: registerDto.confirmPassword,
      deviceInfo: {
        deviceId: registerDto.deviceInfo.deviceId,
        deviceType: registerDto.deviceInfo.deviceType as any,
        deviceName: registerDto.deviceInfo.deviceName,
        platform: registerDto.deviceInfo.platform,
        appVersion: registerDto.deviceInfo.appVersion,
        lastLoginAt: new Date(),
        isActive: true,
      },
    });

    this.logger.log(`User registered successfully: ${registerDto.phoneNumber}`);
    return result;
  }

  /**
   * Login user
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginApiDocs()
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    this.logger.log(`Login attempt for phone: ${loginDto.phoneNumber}`);

    const result = await this.authService.login({
      phoneNumber: loginDto.phoneNumber,
      password: loginDto.password,
      deviceInfo: {
        deviceId: loginDto.deviceInfo.deviceId,
        deviceType: loginDto.deviceInfo.deviceType as any,
        deviceName: loginDto.deviceInfo.deviceName,
        platform: loginDto.deviceInfo.platform,
        appVersion: loginDto.deviceInfo.appVersion,
        lastLoginAt: new Date(),
        isActive: true,
      },
    });

    this.logger.log(`User logged in successfully: ${loginDto.phoneNumber}`);
    return result;
  }

  /**
   * Refresh access token
   */
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @RefreshTokenApiDocs()
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    this.logger.log('Token refresh attempt');

    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);

    this.logger.log('Token refreshed successfully');
    return result;
  }

  /**
   * Logout from current device
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @LogoutApiDocs()
  async logout(@Request() req: any) {
    const { userId, deviceId } = req.user;
    this.logger.log(`Logout attempt for user: ${userId}, device: ${deviceId}`);

    await this.authService.logout(userId, deviceId);

    this.logger.log(`User logged out successfully: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @LogoutAllApiDocs()
  async logoutAll(@Request() req: any) {
    const { userId } = req.user;
    this.logger.log(`Logout all attempt for user: ${userId}`);

    await this.authService.logoutAll(userId);

    this.logger.log(`User logged out from all devices: ${userId}`);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get current user profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @GetProfileApiDocs()
  async getProfile(@Request() req: any) {
    const user = req.user;
    this.logger.log(`Profile request for user: ${user.userId}`);

    return {
      id: user.userId,
      phoneNumber: user.phoneNumber,
      isActive: true,
      deviceId: user.deviceId,
      roles: user.roles,
    };
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @HealthCheckApiDocs()
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'auth',
      timestamp: new Date().toISOString(),
    };
  }
}
