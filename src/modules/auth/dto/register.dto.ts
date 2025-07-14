import { IsString, IsPhoneNumber, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceInfoDto } from './device-info.dto';

/**
 * User Registration Data Transfer Object
 * Handles new user account creation with phone + password authentication
 * 
 * @example
 * {
 *   "phoneNumber": "+84901234567",
 *   "password": "SecurePass123!",
 *   "confirmPassword": "SecurePass123!",
 *   "deviceInfo": { ... }
 * }
 */
export class RegisterDto {
  @ApiProperty({
    description: 'User phone number in international format',
    example: '+84901234567',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsPhoneNumber('VN', {
    message: 'Phone number must be a valid Vietnamese phone number'
  })
  @Transform(({ value }) => value?.replace(/\s+/g, ''))
  phoneNumber: string;

  @ApiProperty({
    description: 'User password with complexity requirements',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  })
  password: string;

  @ApiProperty({
    description: 'Password confirmation (must match password)',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  @MinLength(8, { message: 'Password confirmation must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password confirmation must not exceed 50 characters' })
  confirmPassword: string;

  @ApiProperty({
    description: 'Device information for registration',
    type: DeviceInfoDto,
  })
  @IsNotEmpty({ message: 'Device information is required' })
  deviceInfo: DeviceInfoDto;
}
