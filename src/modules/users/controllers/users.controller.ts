
import {
    Controller,
    Get,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    Inject,
    Logger,
    ValidationPipe,
    ParseUUIDPipe
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiBody
} from '@nestjs/swagger';
import { plainToClass } from 'class-transformer';

import { IUsersService } from '../services/interfaces';
import {
    UpdateProfileDto,
    UpdateAvatarDto,
    UpdateOnlineStatusDto,
    SearchUsersDto,
    ProfileResponseDto
} from '../dto';
import { CurrentUserId } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

/**
 * Users Controller - Profile Management
 * 
 * 🎯 Purpose: Handle user profile-related HTTP requests
 * 📱 Mobile-First: Optimized for mobile messaging apps
 * 🛡️ Security: JWT authentication required
 * 🏗️ Clean Architecture: Controller layer implementation
 */
@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class UserController {
    private readonly logger = new Logger(UserController.name);

    constructor(
        @Inject('IUsersService')
        private readonly usersService: IUsersService,
    ) { }

    /**
     * Get current user's profile
     * 
     * 🎯 Purpose: Get own complete profile
     * 📱 Usage: Profile page, settings screen
     */
    @Get('me')
    @ApiOperation({
        summary: 'Get current user profile',
        description: 'Retrieve complete profile information for the authenticated user'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User profile retrieved successfully',
        type: ProfileResponseDto
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'User not authenticated'
    })
    async getCurrentUserProfile(
        @CurrentUserId() userId: string
    ): Promise<ProfileResponseDto> {
        this.logger.log(`Getting current user profile: ${userId}`);

        const user = await this.usersService.getProfile(userId);
        if (!user) {
            throw new Error('User not found');
        }

        return plainToClass(ProfileResponseDto, user, {
            excludeExtraneousValues: true
        });
    }

    /**
     * Get user profile by ID
     * 
     * 🎯 Purpose: View other users' public profiles
     * 📱 Usage: Contact details, user discovery
     */
    @Get('profile/:userId')
    @ApiOperation({
        summary: 'Get user profile by ID',
        description: 'Retrieve public profile information for any user'
    })
    @ApiParam({
        name: 'userId',
        description: 'User unique identifier',
        example: '64a7b8c9d1e2f3a4b5c6d7e8'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User profile retrieved successfully',
        type: ProfileResponseDto
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found'
    })
    async getUserProfile(
        @Param('userId') targetUserId: string,
        @CurrentUserId() currentUserId?: string
    ): Promise<Partial<ProfileResponseDto>> {
        this.logger.log(`Getting user profile: ${targetUserId} by ${currentUserId}`);

        const profile = await this.usersService.getPublicProfile(targetUserId, currentUserId);
        if (!profile) {
            throw new Error('User not found');
        }

        return plainToClass(ProfileResponseDto, profile, {
            excludeExtraneousValues: true
        });
    }

    /**
     * Update current user's profile
     * 
     * 🎯 Purpose: Update profile information
     * 📱 Usage: Edit profile screen
     */
    @Put('profile')
    @ApiOperation({
        summary: 'Update user profile',
        description: 'Update profile information for the authenticated user'
    })
    @ApiBody({
        type: UpdateProfileDto,
        description: 'Profile update data'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Profile updated successfully',
        type: ProfileResponseDto
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input data'
    })
    async updateProfile(
        @CurrentUserId() userId: string,
        @Body(ValidationPipe) updateData: UpdateProfileDto
    ): Promise<ProfileResponseDto> {
        this.logger.log(`Updating profile for user: ${userId}`);

        const updatedUser = await this.usersService.updateProfile(userId, updateData);
        if (!updatedUser) {
            throw new Error('Failed to update profile');
        }

        return plainToClass(ProfileResponseDto, updatedUser, {
            excludeExtraneousValues: true
        });
    }

    /**
     * Update user avatar
     * 
     * 🎯 Purpose: Update profile avatar
     * 📱 Usage: After file upload from Files module
     */
    @Put('avatar')
    @ApiOperation({
        summary: 'Update user avatar',
        description: 'Update avatar URL for the authenticated user'
    })
    @ApiBody({
        type: UpdateAvatarDto,
        description: 'Avatar URL from file upload service'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Avatar updated successfully',
        type: ProfileResponseDto
    })
    async updateAvatar(
        @CurrentUserId() userId: string,
        @Body(ValidationPipe) avatarData: UpdateAvatarDto
    ): Promise<ProfileResponseDto> {
        this.logger.log(`Updating avatar for user: ${userId}`);

        const updatedUser = await this.usersService.updateAvatar(userId, avatarData);
        if (!updatedUser) {
            throw new Error('Failed to update avatar');
        }

        return plainToClass(ProfileResponseDto, updatedUser, {
            excludeExtraneousValues: true
        });
    }

    /**
     * Remove user avatar
     * 
     * 🎯 Purpose: Remove profile avatar
     * 📱 Usage: Reset to default avatar
     */
    @Delete('avatar')
    @ApiOperation({
        summary: 'Remove user avatar',
        description: 'Remove avatar for the authenticated user'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Avatar removed successfully',
        type: ProfileResponseDto
    })
    async removeAvatar(
        @CurrentUserId() userId: string
    ): Promise<ProfileResponseDto> {
        this.logger.log(`Removing avatar for user: ${userId}`);

        const updatedUser = await this.usersService.removeAvatar(userId);
        if (!updatedUser) {
            throw new Error('Failed to remove avatar');
        }

        return plainToClass(ProfileResponseDto, updatedUser, {
            excludeExtraneousValues: true
        });
    }

    /**
     * Update online status
     * 
     * 🎯 Purpose: Update activity status
     * 📱 Usage: App state changes (foreground/background)
     */
    @Put('online-status')
    @ApiOperation({
        summary: 'Update online status',
        description: 'Update activity status for the authenticated user'
    })
    @ApiBody({
        type: UpdateOnlineStatusDto,
        description: 'Activity status data'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Online status updated successfully'
    })
    async updateOnlineStatus(
        @CurrentUserId() userId: string,
        @Body(ValidationPipe) statusData: UpdateOnlineStatusDto
    ): Promise<{ message: string; status: string }> {
        this.logger.log(`Updating online status for user: ${userId}`);

        const updatedUser = await this.usersService.updateOnlineStatus(userId, statusData);
        if (!updatedUser) {
            throw new Error('Failed to update online status');
        }

        return {
            message: 'Online status updated successfully',
            status: updatedUser.activityStatus
        };
    }

    /**
     * Search users
     * 
     * 🎯 Purpose: Find users with advanced filters
     * 📱 Usage: User discovery, contact search
     */
    @Get('search')
    @ApiOperation({
        summary: 'Search users',
        description: 'Search for users with advanced filtering options'
    })
    @ApiQuery({
        name: 'query',
        required: false,
        description: 'Search query (name, username)',
        example: 'john'
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Page number',
        example: 1
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Items per page',
        example: 10
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Users search results',
        schema: {
            type: 'object',
            properties: {
                users: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ProfileResponseDto' }
                },
                total: { type: 'number' },
                page: { type: 'number' },
                totalPages: { type: 'number' }
            }
        }
    })
    async searchUsers(
        @Query(ValidationPipe) searchParams: SearchUsersDto
    ) {
        this.logger.log(`Searching users with params: ${JSON.stringify(searchParams)}`);

        return await this.usersService.searchUsers(searchParams);
    }

    /**
     * Test endpoint for smoke testing
     * 
     * 🎯 Purpose: Health check for Users module
     * 📱 Usage: Module verification
     */
    @Get('test')
    @ApiOperation({
        summary: 'Test endpoint',
        description: 'Simple test endpoint for module verification'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Module is working correctly'
    })
    async test(): Promise<{ message: string; timestamp: string; module: string }> {
        this.logger.log('Users module test endpoint called');

        return {
            message: 'Users module is working correctly',
            timestamp: new Date().toISOString(),
            module: 'users'
        };
    }
}