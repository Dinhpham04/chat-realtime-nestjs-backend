import { ApiProperty } from '@nestjs/swagger';

/**
 * RegisteredContactsResultDto - Response for registered contacts lookup
 * 
 * 🎯 Purpose: Standardize registered contacts response format
 * 📱 Mobile-First: Include user details and friendship status
 * 🚀 Single Responsibility: Only registered contacts response structure
 */
export class RegisteredContactsResultDto {
  @ApiProperty({
    description: 'Contacts that are registered on the platform',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        phoneNumber: { type: 'string', example: '+84901234567' },
        contactName: { type: 'string', example: 'Nguyen Van A' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            fullName: { type: 'string', example: 'Nguyen Van A' },
            avatarUrl: { type: 'string', example: 'https://example.com/avatar1.jpg' },
            isOnline: { type: 'boolean', example: true },
            mutualFriendsCount: { type: 'number', example: 5 },
            friendshipStatus: { type: 'string', example: 'NONE' },
            joinedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' }
          }
        }
      }
    }
  })
  registered: Array<{
    phoneNumber: string;
    contactName: string;
    user: {
      id: string;
      fullName: string;
      avatarUrl?: string;
      isOnline: boolean;
      mutualFriendsCount: number;
      friendshipStatus: string;
      joinedAt: string;
    };
  }>;

  @ApiProperty({
    description: 'Phone numbers that are not registered',
    type: [String],
    example: ['+84987654321']
  })
  notRegistered: string[];

  @ApiProperty({
    description: 'Registration statistics',
    type: 'object',
    properties: {
      totalChecked: { type: 'number', example: 3 },
      totalRegistered: { type: 'number', example: 1 },
      registrationRate: { type: 'number', example: 33.33 }
    }
  })
  stats: {
    totalChecked: number;
    totalRegistered: number;
    registrationRate: number;
  };
}

/**
 * GetRegisteredContactsResultDto - Response for paginated registered contacts
 * 
 * 🎯 Purpose: Standardize paginated registered contacts response
 * 📱 Mobile-First: Include pagination and filtering metadata
 * 🚀 Single Responsibility: Only paginated contacts response structure
 */
export class GetRegisteredContactsResultDto {
  @ApiProperty({
    description: 'Array of registered contacts',
    type: 'array'
  })
  contacts: any[];

  @ApiProperty({
    description: 'Total number of registered contacts',
    example: 23
  })
  total: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50
  })
  limit: number;

  @ApiProperty({
    description: 'Number of items skipped',
    example: 0
  })
  offset: number;

  @ApiProperty({
    description: 'Whether there are more items available',
    example: false
  })
  hasMore: boolean;

  @ApiProperty({
    description: 'Contact statistics',
    type: 'object',
    properties: {
      totalContacts: { type: 'number', example: 150 },
      registeredCount: { type: 'number', example: 23 },
      availableToFriend: { type: 'number', example: 18 }
    }
  })
  stats: {
    totalContacts: number;
    registeredCount: number;
    availableToFriend: number;
  };

  @ApiProperty({
    description: 'Optional message for empty results',
    required: false,
    example: 'No contacts found. Please import contacts first.'
  })
  message?: string;
}
