import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import { JwtUser } from '../../modules/auth/interfaces/jwt-payload.interface';
import { SocketAuthService, DeviceInfo } from '../services/socket-auth.service';
import { SocketCleanupService } from '../services/socket-cleanup.service';

/**
 * Socket Management Controller
 * 
 * 🎯 Purpose: Admin endpoints for socket and device management
 * 📱 Mobile-First: Monitor device connections and cleanup
 * 🔧 Debug: Useful for development and monitoring
 */
@ApiTags('Socket Management')
@Controller('socket')
export class SocketController {
    constructor(
        private readonly socketAuthService: SocketAuthService,
        private readonly socketCleanupService: SocketCleanupService,
    ) { }

    /**
     * Get current user's devices
     */
    @Get('my-devices')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get current user devices' })
    @ApiResponse({ status: 200, description: 'User devices retrieved successfully' })
    async getMyDevices(@CurrentUser() user: JwtUser) {
        const devices = await this.socketAuthService.getUserDevices(user.userId);
        const onlineCount = await this.socketAuthService.getUserOnlineDeviceCount(user.userId);
        const isOnline = await this.socketAuthService.isUserOnline(user.userId);

        return {
            userId: user.userId,
            isOnline,
            onlineDeviceCount: onlineCount,
            totalDevices: devices.length,
            devices: devices.map(device => ({
                deviceId: device.deviceId,
                deviceType: device.deviceType,
                platform: device.platform,
                isOnline: !!device.socketId && device.socketId.trim() !== '',
                lastActiveAt: device.lastActiveAt,
                socketId: device.socketId || null,
            }))
        };
    }

    /**
     * Check if user is online
     */
    @Get('user/:userId/status')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Check user online status' })
    @ApiResponse({ status: 200, description: 'User status retrieved successfully' })
    async getUserStatus(@Param('userId') userId: string) {
        const isOnline = await this.socketAuthService.isUserOnline(userId);
        const onlineCount = await this.socketAuthService.getUserOnlineDeviceCount(userId);
        const devices = await this.socketAuthService.getUserDevices(userId);

        return {
            userId,
            isOnline,
            onlineDeviceCount: onlineCount,
            totalDevices: devices.length,
            lastActiveDevice: devices
                .filter(d => d.lastActiveAt)
                .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())[0] || null
        };
    }

    /**
     * Get all online users (admin only)
     */
    @Get('online-users')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get all online users (admin)' })
    @ApiResponse({ status: 200, description: 'Online users retrieved successfully' })
    async getOnlineUsers() {
        const onlineUsers = await this.socketAuthService.getAllOnlineUsers();

        const userStats = await Promise.all(
            onlineUsers.map(async (userId) => {
                const deviceCount = await this.socketAuthService.getUserOnlineDeviceCount(userId);
                return { userId, deviceCount };
            })
        );

        return {
            totalOnlineUsers: onlineUsers.length,
            onlineUsers: userStats,
            timestamp: new Date()
        };
    }

    /**
     * Get device information
     */
    @Get('device/:deviceId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get device information' })
    @ApiResponse({ status: 200, description: 'Device info retrieved successfully' })
    async getDeviceInfo(@Param('deviceId') deviceId: string) {
        const device = await this.socketAuthService.getDeviceInfo(deviceId);

        if (!device) {
            return {
                found: false,
                message: 'Device not found or expired'
            };
        }

        const isOnline = !!device.socketId && device.socketId.trim() !== '';

        return {
            found: true,
            device: {
                deviceId: device.deviceId,
                deviceType: device.deviceType,
                platform: device.platform,
                userId: device.userId,
                isOnline,
                lastActiveAt: device.lastActiveAt,
                socketId: isOnline ? device.socketId : null,
            }
        };
    }

    /**
     * Manual cleanup of expired connections
     */
    @Post('cleanup')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Manual cleanup of expired connections' })
    @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
    async manualCleanup() {
        const result = await this.socketCleanupService.manualCleanup();
        return result;
    }

    /**
     * Update device activity (for testing)
     */
    @Post('device/:deviceId/activity')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Update device activity (testing)' })
    @ApiResponse({ status: 200, description: 'Device activity updated' })
    async updateDeviceActivity(@Param('deviceId') deviceId: string) {
        try {
            await this.socketAuthService.updateDeviceActivity(deviceId);

            return {
                success: true,
                message: `Device ${deviceId} activity updated`,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Test endpoint (no auth required)
     */
    @Get('test')
    @ApiOperation({ summary: 'Test socket management endpoint' })
    @ApiResponse({ status: 200, description: 'Test successful' })
    async test() {
        const onlineUsers = await this.socketAuthService.getAllOnlineUsers();

        return {
            message: 'Socket management service is working!',
            timestamp: new Date(),
            stats: {
                totalOnlineUsers: onlineUsers.length,
                serviceStatus: 'healthy'
            }
        };
    }
}
