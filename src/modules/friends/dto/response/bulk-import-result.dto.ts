import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * BulkImportResultDto - Enhanced bulk import response
 * 
 * 🎯 Purpose: Standardize bulk import response format
 * 📱 Mobile-First: Include processing statistics and registered contacts
 * 🚀 Single Responsibility: Only bulk import response structure
 */
export class BulkImportResultDto {
  @ApiProperty({
    description: 'Number of contacts successfully imported',
    example: 148
  })
  imported: number;

  @ApiProperty({
    description: 'Number of contacts updated',
    example: 2
  })
  updated: number;

  @ApiProperty({
    description: 'Number of failed imports',
    example: 0
  })
  failed: number;

  @ApiProperty({
    description: 'Total contacts processed',
    example: 150
  })
  totalProcessed: number;

  @ApiProperty({
    description: 'Registered contacts found during import',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '507f1f77bcf86cd799439011' },
        phoneNumber: { type: 'string', example: '+84901234567' },
        fullName: { type: 'string', example: 'Nguyen Van A' },
        avatarUrl: { type: 'string', example: 'https://example.com/avatar1.jpg' },
        isOnline: { type: 'boolean', example: true }
      }
    }
  })
  registeredContacts: Array<{
    id: string;
    phoneNumber: string;
    fullName: string;
    avatarUrl?: string;
    isOnline: boolean;
  }>;

  @ApiProperty({
    description: 'Failed contacts with error details',
    type: 'array',
    items: { type: 'string' },
    example: []
  })
  failedContacts: string[];

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 2341
  })
  processingTimeMs: number;

  @ApiProperty({
    description: 'Number of duplicate contacts',
    example: 5
  })
  duplicates: number;

  @ApiProperty({
    description: 'Import errors',
    type: [String],
    example: ['Failed to process contact: Invalid phone number']
  })
  errors: string[];

  @ApiProperty({
    description: 'Mobile optimization information',
    type: 'object',
    properties: {
      lowDataMode: { type: 'boolean', example: false },
      networkOptimized: { type: 'string', example: 'high' },
      batteryImpact: { type: 'string', example: 'normal' }
    }
  })
  optimization: {
    lowDataMode: boolean;
    networkOptimized: 'high' | 'medium' | 'low';
    batteryImpact: 'normal' | 'optimized';
  };
}
