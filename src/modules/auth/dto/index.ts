/**
 * Auth DTOs Index
 * Central export point for all authentication-related Data Transfer Objects
 * 
 * Following Senior Developer Guidelines:
 * - Single Responsibility: Each DTO has one purpose
 * - Clear naming: Descriptive and intention-revealing names
 * - Modular organization: Grouped by functionality
 */

// Authentication DTOs
export { LoginDto } from './login.dto';
export { RegisterDto } from './register.dto';
export { RefreshTokenDto } from './refresh-token.dto';

// Shared DTOs
export { DeviceInfoDto } from './device-info.dto';

// Social Authentication DTOs (for future implementation)
export { SocialLoginDto, GoogleAuthCallbackDto } from './social-login.dto';

export * from './auth-response.dto';
