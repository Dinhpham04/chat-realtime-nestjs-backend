import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityStatus } from '../enums';

/**
 * Update Online Status DTO
 * 
 * 🎯 Purpose: Update user activity status
 * 📱 Mobile-First: Handle app state changes
 * 🛡️ Security: Enum validation
 */
export class UpdateOnlineStatusDto {
    @ApiPropertyOptional({
        description: 'User activity status',
        example: ActivityStatus.ONLINE,
        enum: ActivityStatus
    })
    @IsOptional()
    @IsEnum(ActivityStatus, { message: 'Activity status must be a valid enum value' })
    activityStatus?: ActivityStatus;
}
