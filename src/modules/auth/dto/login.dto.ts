import { IsString, IsPhoneNumber, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceInfoDto } from './device-info.dto';

/**
 * User Login Data Transfer Object
 * Handles user authentication with phone + password
 * 
 * @example
 * {
 *   "phoneNumber": "+84901234567",
 *   "password": "SecurePass123!",
 *   "deviceInfo": { ... }
 * }
 */
export class LoginDto {
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
    description: 'User password',
    example: 'SecurePass123!',
    minLength: 6,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  password: string;

  @ApiProperty({
    description: 'Device information for login tracking',
    type: DeviceInfoDto,
  })
  @IsNotEmpty({ message: 'Device information is required' })
  deviceInfo: DeviceInfoDto;
}
