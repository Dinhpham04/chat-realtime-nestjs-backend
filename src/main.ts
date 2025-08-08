import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './shared/utils/swagger/setupSwagger';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import {
  logNetworkConfiguration,
  validateNetworkConnectivity,
  isDevelopmentEnvironment
} from './shared/utils/network/network-utils';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

/**
 * Bootstrap function - Application entry point
 * Following Senior Guidelines:
 * - Documentation is Key: Complete Swagger setup
 * - Security First: Proper authentication documentation
 * - Performance: Optimized Swagger configuration
 * - Mobile-First: Local network access for Expo Go development
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix for API routes
  const apiPrefix = configService.get('apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  // Static files serving - test-app available at root URL
  if (isDevelopmentEnvironment()) {
    const staticPath = join(__dirname, '..', '..', 'test-app');
    app.useStaticAssets(staticPath);
    console.log(`🌐 Static files served from: ${staticPath}`);
    console.log(`📱 Test app available at: http://localhost:${configService.get('port')}/voice-call-test.html`);
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter - Senior Level Error Handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enhanced CORS for local development and mobile access
  const corsConfig = configService.get('cors');
  app.enableCors({
    origin: corsConfig.origin,
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
  });

  // Log CORS configuration in development
  if (isDevelopmentEnvironment()) {
    console.log('🔐 CORS Origins configured:', corsConfig.origin);
  }

  // Swagger Configuration - Senior Level Documentation
  setupSwagger(app, apiPrefix);

  const port = configService.get('port');
  const host = configService.get('host');

  // Start server with configured host (0.0.0.0 for local network access)
  await app.listen(port, host);

  // Network configuration logging for development
  logNetworkConfiguration(port, apiPrefix);

  // Validate network connectivity in development
  if (isDevelopmentEnvironment()) {
    const isNetworkAccessible = await validateNetworkConnectivity(port);
    if (!isNetworkAccessible) {
      console.warn('⚠️  Warning: Network connectivity validation failed');
      console.warn('   Mobile devices may not be able to connect');
    } else {
      console.log('✅ Network connectivity validated - Mobile access ready');
    }
  }
}

bootstrap();
