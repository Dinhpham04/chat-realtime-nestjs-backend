/**
 * Edit Message DTO
 * 
 * 🎯 Purpose: Validation for editing existing messages
 * 📱 Mobile-First: Support for content updates and mentions
 * 🚀 Clean Architecture: Input validation with business rules
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
  Matches,
  ValidateNested,
  IsObject
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TextContentDto, LocationContentDto, MediaContentDto, FileContentDto } from './send-message.dto';

export class EditMessageDto {
  @ApiProperty({
    description: 'Updated message content',
    oneOf: [
      { $ref: '#/components/schemas/TextContentDto' },
      { $ref: '#/components/schemas/LocationContentDto' },
      { $ref: '#/components/schemas/MediaContentDto' },
      { $ref: '#/components/schemas/FileContentDto' }
    ]
  })
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object) // Will be validated in service layer based on message type
  content: TextContentDto | LocationContentDto | MediaContentDto | FileContentDto;

  @ApiPropertyOptional({
    description: 'Updated array of user IDs being mentioned',
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Matches(/^[0-9a-fA-F]{24}$/, { each: true, message: 'Invalid user ID format in mentions' })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Reason for editing (optional)',
    example: 'Fixed typo'
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  editReason?: string;
}
