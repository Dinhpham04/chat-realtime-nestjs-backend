import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { CallType } from '../schemas/call.schema';

export class InitiateCallDto {
  @ApiProperty({
    description: 'ID of the user to call',
    example: 'user123',
    type: String
  })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiProperty({
    description: 'Type of call to initiate',
    enum: CallType,
    example: 'voice',
    enumName: 'CallType'
  })
  @IsEnum(CallType)
  callType: CallType;

  @ApiProperty({
    description: 'Optional conversation ID for group calls',
    example: 'conv_123456',
    required: false,
    type: String
  })
  @IsString()
  @IsOptional()
  conversationId?: string;
}
