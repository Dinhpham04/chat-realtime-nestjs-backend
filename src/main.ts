import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './shared/utils/swagger/setupSwagger';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

/**
 * Bootstrap function - Application entry point
 * Following Senior Guidelines:
 * - Documentation is Key: Complete Swagger setup
 * - Security First: Proper authentication documentation
 * - Performance: Optimized Swagger configuration
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get('apiPrefix');
  app.setGlobalPrefix(apiPrefix);

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

  // CORS
  app.enableCors({
    origin: configService.get('cors.origin'),
    credentials: true,
  });

  // Swagger Configuration - Senior Level Documentation
  setupSwagger(app, apiPrefix);

  const port = configService.get('port');
  await app.listen(port);
  console.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `📚 Swagger documentation: http://localhost:${port}/${apiPrefix}/docs`,
  );
}

bootstrap();
