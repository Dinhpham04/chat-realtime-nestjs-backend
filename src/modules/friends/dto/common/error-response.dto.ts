import { ApiProperty } from '@nestjs/swagger';

/**
 * ErrorResponseDto - Standard error response structure
 * 
 * 🎯 Purpose: Standardize error response format across all endpoints
 * 📱 Mobile-First: Structured error information for apps
 * 🚀 Single Responsibility: Only error response structure
 */
export class ErrorResponseDto {
    @ApiProperty({
        description: 'Error message',
        example: 'Friend request already exists'
    })
    message: string;

    @ApiProperty({
        description: 'Error code',
        example: 'FRIEND_REQUEST_EXISTS'
    })
    error: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 400
    })
    statusCode: number;
}
