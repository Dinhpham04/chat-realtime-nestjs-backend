import { ApiProperty } from '@nestjs/swagger';

/**
 * ContactStatsResultDto - Enhanced contact statistics response
 * 
 * 🎯 Purpose: Comprehensive contact statistics with insights
 * 📱 Mobile-First: Include growth and engagement metrics
 * 🚀 Single Responsibility: Only contact statistics response structure
 */
export class ContactStatsResultDto {
  @ApiProperty({
    description: 'Total number of imported contacts',
    example: 156
  })
  totalContacts: number;

  @ApiProperty({
    description: 'Number of registered contacts',
    example: 23
  })
  registeredContacts: number;

  @ApiProperty({
    description: 'Number of unregistered contacts',
    example: 133
  })
  unregisteredContacts: number;

  @ApiProperty({
    description: 'Number of contacts auto-friended',
    example: 18
  })
  autoFriendedCount: number;

  @ApiProperty({
    description: 'Contact source breakdown',
    type: 'object',
    properties: {
      PHONEBOOK: { type: 'number', example: 150 },
      MANUAL: { type: 'number', example: 6 }
    }
  })
  contactSources: {
    PHONEBOOK: number;
    MANUAL: number;
  };

  @ApiProperty({
    description: 'Last sync timestamp',
    example: '2024-01-15T10:30:00.000Z'
  })
  lastSyncAt: string;
}
