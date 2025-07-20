import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpCode,
    Logger,
    Request,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiConsumes,
    ApiProduces,
} from '@nestjs/swagger';
import { FriendsService } from '../services';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
    SendFriendRequestDto,
    RespondToFriendRequestDto,
    GetFriendRequestsDto,
    GetFriendsListDto,
    BlockUserDto,
    SearchUsersDto,
} from '../dto';
import {
    SendFriendRequestApiDocs,
    RespondToFriendRequestApiDocs,
    GetFriendRequestsApiDocs,
    GetFriendsListApiDocs,
    SearchUsersApiDocs,
    RemoveFriendApiDocs,
    BlockUserApiDocs,
    UnblockUserApiDocs,
    GetFriendStatusApiDocs,
} from '../documentation/friends.api-docs';

/**
 * Friends Controller
 * 
 * Following instruction-senior.md:
 * - Clean Architecture: Separation of concerns
 * - Single Responsibility: Each method handles one operation
 * - Documentation: Separated into swagger files
 * - Validation: DTOs handle input validation
 * - Security: JWT authentication required
 */
@Controller('friends')
@ApiTags('Friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiConsumes('application/json')
@ApiProduces('application/json')
export class FriendsController {
    private readonly logger = new Logger(FriendsController.name);

    constructor(private readonly friendsService: FriendsService) { }

    /**
     * Send friend request to another user
     */
    @Post('requests')
    @HttpCode(HttpStatus.CREATED)
    @SendFriendRequestApiDocs()
    async sendFriendRequest(
        @Request() req: any,
        @Body() sendFriendRequestDto: SendFriendRequestDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} sending friend request`);

        const result = await this.friendsService.sendFriendRequest({
            senderId: userId,
            receiverId: sendFriendRequestDto.receiverId,
            phoneNumber: sendFriendRequestDto.phoneNumber,
            message: sendFriendRequestDto.message,
            addMethod: sendFriendRequestDto.addMethod,
        });

        this.logger.log(`Friend request sent successfully by user ${userId}`);
        return result;
    }

    /**
     * Accept or decline a friend request
     */
    @Put('requests/:requestId/respond')
    @HttpCode(HttpStatus.OK)
    @RespondToFriendRequestApiDocs()
    async respondToFriendRequest(
        @Request() req: any,
        @Param('requestId') requestId: string,
        @Body() respondDto: RespondToFriendRequestDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} responding to friend request ${requestId}`);

        if (respondDto.action === 'ACCEPT') {
            await this.friendsService.acceptFriendRequest(requestId, userId);
        } else {
            await this.friendsService.declineFriendRequest(requestId, userId);
        }

        this.logger.log(`Friend request ${requestId} ${respondDto.action.toLowerCase()}ed`);
        return {
            message: `Friend request ${respondDto.action.toLowerCase()}ed successfully`,
            action: respondDto.action
        };
    }

    /**
     * Get list of friend requests with comprehensive filtering
     * 
     * Following instruction-senior.md:
     * - Senior-level implementation with full filtering support
     * - Support for type: incoming/outgoing/all
     * - Support for status: PENDING/ACCEPTED/DECLINED
     * - Pagination with limit/offset
     * - Security validation and error handling
     */
    @Get('requests')
    @HttpCode(HttpStatus.OK)
    @GetFriendRequestsApiDocs()
    async getFriendRequests(
        @Request() req: any,
        @Query() queryDto: GetFriendRequestsDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} retrieving friend requests: type=${queryDto.type}, status=${queryDto.status}`);

        const result = await this.friendsService.getFriendRequests(userId, {
            type: queryDto.type,
            status: queryDto.status,
            limit: queryDto.limit,
            offset: queryDto.offset,
        });

        const response = {
            requests: result.requests,
            total: result.total,
            hasMore: result.hasMore,
            type: queryDto.type || 'all',
            status: queryDto.status || 'all',
            limit: queryDto.limit || 20,
            offset: queryDto.offset || 0,
        };

        this.logger.log(`Retrieved ${result.requests.length} friend requests for user ${userId}`);
        return response;
    }

    /**
     * Get list of friends
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    @GetFriendsListApiDocs()
    async getFriendsList(
        @Request() req: any,
        @Query() getFriendsListDto: GetFriendsListDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} retrieving friends list`);

        const result = await this.friendsService.getFriendsList(
            userId,
            getFriendsListDto,
        );

        return result;
    }

    /**
     * Search users to add as friends với smart auto-detection
     * 
     * Following instruction-senior.md:
     * - Smart input detection: auto-detect phone vs name
     * - Security: input validation and sanitization
     * - Performance: pagination and result limiting
     * - Business logic: exclude current friends and pending requests
     */
    @Get('search')
    @HttpCode(HttpStatus.OK)
    @SearchUsersApiDocs()
    async searchUsers(
        @Request() req: any,
        @Query() searchUsersDto: SearchUsersDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} searching users: "${searchUsersDto.query}"`);

        const result = await this.friendsService.searchUsers({
            query: searchUsersDto.query,
            page: searchUsersDto.page || 1,
            limit: searchUsersDto.limit || 10,
        }, userId);

        return {
            users: result,
            total: result.length,
        };
    }

    /**
     * Remove a friend from friends list
     */
    @Delete(':friendId')
    @HttpCode(HttpStatus.OK)
    @RemoveFriendApiDocs()
    async removeFriend(
        @Request() req: any,
        @Param('friendId') friendId: string,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} removing friend ${friendId}`);

        await this.friendsService.removeFriend(userId, friendId);

        this.logger.log(`Friend ${friendId} removed successfully by user ${userId}`);
        return { message: 'Friend removed successfully' };
    }

    /**
     * Block a user
     */
    @Post('block/:targetUserId')
    @HttpCode(HttpStatus.OK)
    @BlockUserApiDocs()
    async blockUser(
        @Request() req: any,
        @Param('targetUserId') targetUserId: string,
        @Body() blockUserDto: BlockUserDto,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} blocking user ${targetUserId}`);

        await this.friendsService.blockUser({
            userId,
            friendId: targetUserId,
            reason: blockUserDto.reason,
        });

        this.logger.log(`User ${targetUserId} blocked successfully by user ${userId}`);
        return {
            message: 'User blocked successfully',
            blockedAt: new Date().toISOString(),
        };
    }

    /**
     * Unblock a previously blocked user
     */
    @Delete('block/:userId')
    @HttpCode(HttpStatus.OK)
    @UnblockUserApiDocs()
    async unblockUser(
        @Request() req: any,
        @Param('userId') targetUserId: string,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} unblocking user ${targetUserId}`);

        await this.friendsService.unblockUser(userId, targetUserId);

        this.logger.log(`User ${targetUserId} unblocked successfully by user ${userId}`);
        return { message: 'User unblocked successfully' };
    }

    /**
     * Get comprehensive friendship status with another user
     * 
     * Following instruction-senior.md:
     * - Senior-level implementation with detailed status
     * - Security validation and error handling
     * - Mobile-optimized response format
     */
    @Get('status/:userId')
    @HttpCode(HttpStatus.OK)
    @GetFriendStatusApiDocs()
    async getFriendStatus(
        @Request() req: any,
        @Param('userId') targetUserId: string,
    ) {
        const userId = req.user.userId;
        this.logger.log(`User ${userId} checking status with user ${targetUserId}`);

        const result = await this.friendsService.getFriendStatus(userId, targetUserId);

        this.logger.log(`Friendship status retrieved for ${userId} -> ${targetUserId}: ${result.status}`);
        return result;
    }
}
