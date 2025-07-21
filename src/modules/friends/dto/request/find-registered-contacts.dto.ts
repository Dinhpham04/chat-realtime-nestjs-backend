import { IsArray, IsString, IsPhoneNumber, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * FindRegisteredContactsDto - Check which contacts are registered
 * 
 * 🎯 Purpose: Validate phone numbers for registration check
 * 📱 Mobile-First: Bulk phone number lookup
 * 🚀 Single Responsibility: Only registration check validation
 */
export class FindRegisteredContactsDto {
  @ApiProperty({
    description: 'Array of phone numbers to check registration status',
    type: [String],
    example: ['+84901234567', '+84987654321', '+84912345678'],
    maxItems: 500
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(500)
  phoneNumbers: string[];
}
