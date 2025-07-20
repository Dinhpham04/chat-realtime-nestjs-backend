import { ApiProperty } from '@nestjs/swagger';

/**
 * SuccessResponseDto - Standard success response structure
 * 
 * 🎯 Purpose: Standardize success response format across all endpoints
 * 📱 Mobile-First: Simple success confirmation
 * 🚀 Single Responsibility: Only success response structure
 */
export class SuccessResponseDto {
    @ApiProperty({
        description: 'Success message',
        example: 'Operation completed successfully'
    })
    message: string;

    @ApiProperty({
        description: 'Success status',
        example: true
    })
    success: boolean;
}
