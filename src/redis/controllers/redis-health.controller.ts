import { Controller, Get } from '@nestjs/common';
import { RedisCacheService, RealTimeStateService } from '../services';
import { Public } from 'src/shared';

@Public()
@Controller('redis')
export class RedisHealthController {
  constructor(
    private readonly cacheService: RedisCacheService,
    private readonly realTimeState: RealTimeStateService,
  ) { }

  @Get('health')
  async getHealth() {
    try {
      const health = await this.cacheService.healthCheck();
      const stats = await this.realTimeState.getStats();

      return {
        status: health.status,
        latency: `${health.latency}ms`,
        timestamp: new Date().toISOString(),
        stats: {
          onlineUsers: stats.onlineUsers,
          totalPresenceKeys: stats.totalPresenceKeys,
          activeConversations: stats.activeConversations,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('stats')
  async getStats() {
    try {
      const realTimeStats = await this.realTimeState.getStats();

      return {
        timestamp: new Date().toISOString(),
        realTime: realTimeStats,
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('online-users')
  async getOnlineUsers() {
    try {
      const onlineUsers = await this.realTimeState.getOnlineUsers();

      return {
        count: onlineUsers.length,
        users: onlineUsers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
