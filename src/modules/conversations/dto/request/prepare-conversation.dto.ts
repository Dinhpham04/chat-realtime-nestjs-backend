/**
 * Prepare Conversation DTO
 * 
 * 🎯 Purpose: Input validation for prepare conversation endpoint
 * 📱 Mobile-First: Simple validation for click contact action
 */

import { IsNotEmpty, IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrepareConversationDto {
  @ApiProperty({
    description: 'ID of the user to start conversation with',
    example: '64f1a2b3c4d5e6f7a8b9c0d1'
  })
  @IsNotEmpty({ message: 'Participant ID is required' })
  @IsString({ message: 'Participant ID must be a string' })
  @IsMongoId({ message: 'Participant ID must be a valid MongoDB ObjectId' })
  participantId: string;
}
