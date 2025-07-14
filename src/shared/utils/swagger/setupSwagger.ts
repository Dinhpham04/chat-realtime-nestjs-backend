import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/**
 * Setup Swagger Documentation
 * Following instruction-senior.md requirements:
 * - OpenAPI/Swagger specification
 * - Request/response examples
 * - Error codes and messages
 * - Authentication requirements
 * - Rate limiting information
 */
export function setupSwagger(app: any, apiPrefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('NestJS Backend API - Messaging App')
    .setDescription(`
# Real-time Messaging Application API

## 🎯 Features
- **Authentication & Authorization**: JWT-based with refresh tokens
- **Real-time Messaging**: WebSocket support for instant communication
- **Device Management**: Multi-device user sessions
- **User Management**: Complete user lifecycle management
- **Security**: Rate limiting, input validation, audit logging

## 🔒 Security
- All endpoints require authentication unless specified
- Rate limiting: 100 requests per 15 minutes per IP
- Input validation on all endpoints
- Audit logging for security events

## 📊 Performance
- Response time < 200ms for 95% of requests
- Redis caching for frequently accessed data
- Optimized database queries with proper indexing
- Pagination for large datasets

## 🚀 Getting Started
1. Register a new user account
2. Login to receive JWT tokens
3. Use the access token for authenticated requests
4. Refresh tokens when they expire
    `)
    .setVersion('1.0.0')
    .setContact(
      'Development Team',
      'https://github.com/Dinhpham04/chat-realtime-nestjs-backend',
      'dev@messagingapp.com'
    )
    .setLicense(
      'MIT',
      'https://opensource.org/licenses/MIT'
    )

    // Authentication Configuration
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )

    // API Tags for Organization
    .addTag('Authentication', 'User authentication and session management')
    .addTag('Users', 'User profile and management operations')
    .addTag('Devices', 'Device registration and management')
    .addTag('Messages', 'Message operations and real-time communication')
    .addTag('Friends', 'Friend relationship management')
    .addTag('Conversations', 'Conversation and chat management')
    .addTag('Health', 'System health and monitoring endpoints')

    // External Documentation
    .setExternalDoc(
      'GitHub Repository',
      'https://github.com/Dinhpham04/chat-realtime-nestjs-backend'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Swagger UI Setup with Advanced Options
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'NestJS API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0 }
    `,
  });
}
