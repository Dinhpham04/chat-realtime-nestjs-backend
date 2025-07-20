import { Controller, Get, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { Public, CurrentUser, JwtUser } from './shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };
  }

  @Get('protected')
  getProtected(@CurrentUser() user: JwtUser) {
    return {
      success: true,
      data: {
        message: 'This is a protected route!',
        user: {
          userId: user.userId,
          phoneNumber: user.phoneNumber,
          deviceId: user.deviceId,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get('test-error')
  testError() {
    throw new BadRequestException('This is a test error message from Global Exception Filter');
  }

  @Public()
  @Get('test-error-with-stack')
  testErrorWithStack() {
    // Simulate error trong nested function call để test stack trace
    this.simulateDeepError();
  }

  private simulateDeepError() {
    this.anotherFunction();
  }

  private anotherFunction() {
    // This will throw error at line ~XX in app.controller.ts
    throw new BadRequestException('Error with detailed stack trace for line number testing');
  }
}
