import { IsString, IsOptional, IsEnum, IsNotEmpty, IsPhoneNumber, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddMethod } from '../../types';

/**
 * SendFriendRequestDto - Request validation for friend requests
 * 
 * 🎯 Purpose: Validate friend request input data
 * 📱 Mobile-First: Support both userId and phoneNumber
 * 🚀 Single Responsibility: Only friend request validation
 */
export class SendFriendRequestDto {
    @ApiPropertyOptional({
        description: 'Friend ID để send request',
        example: '67890abcdef1234567890123'
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    receiverId?: string;

    @ApiPropertyOptional({
        description: 'Phone number để find và send request',
        example: '+84901234567'
    })
    @IsOptional()
    @IsPhoneNumber()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'Optional message với friend request',
        example: 'Hi! Let\'s be friends on the app',
        maxLength: 200
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    message?: string;

    @ApiPropertyOptional({
        description: 'Method used để add friend',
        enum: AddMethod,
        example: AddMethod.MANUAL
    })
    @IsOptional()
    @IsEnum(AddMethod)
    addMethod?: AddMethod;
}
