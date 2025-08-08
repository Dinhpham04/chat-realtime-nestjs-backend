import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { isDevelopmentEnvironment } from '../shared/utils/network/network-utils';

@Controller()
export class StaticController {
    constructor(private readonly configService: ConfigService) { }

    /**
     * Redirect root URL to voice call test app in development
     * In production, this would serve a different landing page
     */
    @Get()
    getRoot(@Res() res: Response) {
        if (isDevelopmentEnvironment()) {
            // Redirect to voice call test app
            return res.redirect('/voice-call-test.html');
        }

        // In production, serve a proper landing page or API info
        return res.json({
            message: 'Chat Realtime NestJS Backend API',
            version: '1.0.0',
            documentation: `/api/v1/docs`,
            status: 'running'
        });
    }

    /**
     * Health check endpoint at root level
     */
    @Get('health')
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
    }
}
