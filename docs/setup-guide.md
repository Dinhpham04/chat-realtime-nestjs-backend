# 🚀 Hướng Dẫn Setup Project - Messaging App Backend

## 📋 Danh Sách Công Việc Setup

### 1. **Cài Đặt Dependencies** ⚙️

#### A. Dependencies cốt lõi
```bash
# NestJS core packages (đã có)
npm install @nestjs/common @nestjs/core @nestjs/platform-express

# Database & ODM
npm install @nestjs/mongoose mongoose
npm install @nestjs/config

# Authentication & Security
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt @types/bcrypt
npm install class-validator class-transformer

# Redis & Cache
npm install ioredis @nestjs/cache-manager cache-manager-redis-store

# WebSocket & Real-time
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# File Upload
npm install @nestjs/platform-express multer @types/multer

# Utilities
npm install uuid @types/uuid
```

#### B. Dev Dependencies
```bash
npm install -D @types/passport-jwt
npm install -D @types/bcrypt
npm install -D @types/multer
```

### 2. **Cấu Hình Environment Variables** 🔧

#### Tạo file `.env`
```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
MONGODB_URI=mongodb://localhost:27017/messaging-app
# Production: mongodb+srv://username:password@cluster.mongodb.net/messaging-app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# Production: redis://username:password@host:port

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

#### Tạo file `.env.example`
```env
# Copy từ .env và xóa các giá trị sensitive
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
MONGODB_URI=mongodb://localhost:27017/messaging-app
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
# ... etc
```

### 3. **Cấu Hình Docker Compose** 🐳

#### Tạo file `docker-compose.yml`
```yaml
version: '3.8'

services:
  # MongoDB local cho dev
  mongodb:
    image: mongo:7
    container_name: messaging-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin123
      MONGO_INITDB_DATABASE: messaging-app
    volumes:
      - mongodb_data:/data/db
      - ./docker/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro

  # Redis local cho dev
  redis:
    image: redis:7-alpine
    container_name: messaging-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  # MongoDB Admin UI (optional)
  mongo-express:
    image: mongo-express
    container_name: messaging-mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: admin123
      ME_CONFIG_MONGODB_URL: mongodb://admin:admin123@mongodb:27017/
    depends_on:
      - mongodb

  # Redis Commander (optional)
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: messaging-redis-commander
    restart: unless-stopped
    ports:
      - "8082:8081"
    environment:
      REDIS_HOSTS: local:redis:6379
    depends_on:
      - redis

volumes:
  mongodb_data:
  redis_data:
```

#### Tạo file `docker/mongo-init.js`
```javascript
// Tạo user cho app
db = db.getSiblingDB('messaging-app');
db.createUser({
  user: 'app',
  pwd: 'app123',
  roles: [
    {
      role: 'readWrite',
      db: 'messaging-app',
    },
  ],
});

// Tạo collections với indexes
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

db.createCollection('conversations');
db.conversations.createIndex({ members: 1 });
db.conversations.createIndex({ type: 1 });

db.createCollection('messages');
db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1 });
```

### 4. **Cấu Hình NestJS Config Module** ⚙️

#### Tạo `src/config/configuration.ts`
```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/messaging-app',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880, // 5MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png'],
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
});
```

### 5. **Cấu Hình Database Module** 🗄️

#### Tạo `src/database/database.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

### 6. **Cấu Hình Redis Module** ⚡

#### Tạo `src/redis/redis.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

### 7. **Cập Nhật App Module** 🏗️

#### Cập nhật `src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 8. **Cập Nhật Main.ts** 🚀

#### Cập nhật `src/main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Global prefix
  const apiPrefix = configService.get('apiPrefix');
  app.setGlobalPrefix(apiPrefix);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // CORS
  app.enableCors({
    origin: configService.get('cors.origin'),
    credentials: true,
  });
  
  const port = configService.get('port');
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
}
bootstrap();
```

### 9. **Tạo Folder Structure** 📁

```bash
mkdir -p src/modules/auth
mkdir -p src/modules/users
mkdir -p src/modules/conversations
mkdir -p src/modules/messages
mkdir -p src/modules/friends
mkdir -p src/shared/dto
mkdir -p src/shared/schemas
mkdir -p src/shared/guards
mkdir -p src/shared/decorators
mkdir -p src/shared/utils
mkdir -p uploads
mkdir -p docker
```

### 10. **Scripts Package.json** 📝

#### Thêm vào `package.json`
```json
{
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  }
}
```

## 🎯 Thứ Tự Thực Hiện

1. **Cài đặt dependencies** (`npm install`)
2. **Tạo các file cấu hình** (`.env`, `docker-compose.yml`)
3. **Tạo folder structure**
4. **Tạo config, database, redis modules**
5. **Cập nhật app.module.ts và main.ts**
6. **Chạy Docker services** (`npm run docker:up`)
7. **Test kết nối** (`npm run start:dev`)

## ✅ Checklist Hoàn Thành

- [ ] Cài đặt tất cả dependencies
- [ ] Tạo file `.env` và `.env.example`
- [ ] Tạo `docker-compose.yml`
- [ ] Tạo folder structure đầy đủ
- [ ] Cấu hình ConfigModule
- [ ] Cấu hình DatabaseModule (MongoDB)
- [ ] Cấu hình RedisModule (ioredis)
- [ ] Cập nhật AppModule
- [ ] Cập nhật main.ts với validation, CORS
- [ ] Test chạy `docker-compose up -d`
- [ ] Test chạy `npm run start:dev`
- [ ] Kiểm tra kết nối MongoDB (port 27017)
- [ ] Kiểm tra kết nối Redis (port 6379)
- [ ] Truy cập MongoDB UI (port 8081)
- [ ] Truy cập Redis UI (port 8082)

Sau khi hoàn thành setup, bạn sẽ có:
- ✅ NestJS app chạy trên http://localhost:3000
- ✅ MongoDB chạy trên localhost:27017
- ✅ Redis chạy trên localhost:6379
- ✅ MongoDB Express UI trên http://localhost:8081
- ✅ Redis Commander UI trên http://localhost:8082
