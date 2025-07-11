# 4. Middleware, Guard, Interceptor

## Tổng quan: Request Lifecycle trong NestJS

Khi một request đến NestJS application, nó sẽ đi qua các layer theo thứ tự sau:

```
Request → Middleware → Guard → Interceptor (before) → Pipe → Controller → Service → Controller → Interceptor (after) → Filter → Response
```

### So sánh với Express.js
```javascript
// Express - Middleware chain thủ công
app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use('/api/users', userRoutes);

// NestJS - Tự động quản lý lifecycle
@Controller('users')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) { ... }
}
```

---

## 1. Middleware - Xử lý Request đầu tiên

### Middleware là gì?
- **Middleware** chạy **trước khi** request đến route handler.
- Giống như middleware trong Express.js.
- Thường dùng cho: logging, CORS, body parsing, authentication check cơ bản.

### Functional Middleware
```typescript
// middleware/logger.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // Quan trọng: phải gọi next() để chuyển sang middleware tiếp theo
}
```

### Class-based Middleware
```typescript
// middleware/cors.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Thêm CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight request
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  }
}
```

### Authentication Middleware
```typescript
// middleware/auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const payload = this.jwtService.verify(token);
      req['user'] = payload; // Gắn user info vào request
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

### Đăng ký Middleware
```typescript
// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { logger } from './middleware/logger.middleware';
import { CorsMiddleware } from './middleware/cors.middleware';
import { AuthMiddleware } from './middleware/auth.middleware';

@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply cho tất cả routes
    consumer
      .apply(logger, CorsMiddleware)
      .forRoutes('*');

    // Apply cho route cụ thể
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/register', method: RequestMethod.POST },
      )
      .forRoutes('*');

    // Apply cho controller cụ thể
    consumer
      .apply(AuthMiddleware)
      .forRoutes(UsersController, MessagesController);
  }
}
```

---

## 2. Guard - Bảo vệ Route

### Guard là gì?
- **Guard** quyết định liệu request có được phép **truy cập route** hay không.
- Chạy **sau Middleware** nhưng **trước Interceptor và Pipe**.
- Trả về `true` (allow) hoặc `false` (deny), hoặc throw exception.
- Thường dùng cho: authentication, authorization, role-based access.

### Authentication Guard
```typescript
// guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Access token required');
    }

    try {
      const payload = this.jwtService.verify(token);
      request['user'] = payload; // Gắn user info để dùng trong controller
      return true; // Cho phép truy cập
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

### Role-based Authorization Guard
```typescript
// guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lấy roles được định nghĩa trong decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // Method level
      context.getClass(),   // Class level
    ]);

    if (!requiredRoles) {
      return true; // Không yêu cầu role cụ thể
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(`Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
```

### Custom Decorator cho Roles
```typescript
// decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../guards/roles.guard';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles); // gom các role vào mảng Role[]
```

### Ownership Guard (Kiểm tra quyền sở hữu)
```typescript
// guards/ownership.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    // Kiểm tra user có phải là chủ sở hữu resource không
    const resource = await this.usersService.findOne(resourceId);
    
    if (!resource) {
      return false;
    }

    if (resource.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only access your own resources');
    }

    return true;
  }
}
```

### Sử dụng Guard
```typescript
// users.controller.ts
import { Controller, Get, Post, UseGuards, Param } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../guards/roles.guard';

@Controller('users')
@UseGuards(AuthGuard) // Apply cho toàn bộ controller
export class UsersController {
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR) // Chỉ admin và moderator
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(OwnershipGuard) // Kiểm tra quyền sở hữu
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // Không cần guard cho endpoint này
    return this.usersService.create(createUserDto);
  }
}
```

---

## 3. Interceptor - Can thiệp Request/Response

### Interceptor là gì?
- **Interceptor** có thể can thiệp vào request **trước và sau** khi controller method thực thi.
- Chạy **sau Guard** nhưng **trước và sau Controller**.
- Thường dùng cho: logging, transform response, caching, performance monitoring.

### Logging Interceptor
```typescript
// interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();

    this.logger.log(`➡️  ${method} ${url}`);
    this.logger.debug(`Body: ${JSON.stringify(body)}`);
    this.logger.debug(`Query: ${JSON.stringify(query)}`);
    this.logger.debug(`Params: ${JSON.stringify(params)}`);

    return next
      .handle() // tiếp tục xử lý request 
      .pipe( // Sử dụng RxJS pipe để xử lý response trước khi gửi về client
        tap((response) => { // tap để thực hiện một hành động phụ mà không thay đổi dữ liệu response
          const endTime = Date.now();
          const duration = endTime - startTime;
          this.logger.log(`⬅️  ${method} ${url} - ${duration}ms`);
          this.logger.debug(`Response: ${JSON.stringify(response)}`);
        }),
      );
  }
}
```

### Transform Response Interceptor
```typescript
// interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> { // dữ liệu đầu vào T, dữ liệu trả về Response<T>
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();
    
    return next.handle().pipe(
      map((data) => ({ // Chuyển đổi dữ liệu trả về thành định dạng Response
        success: true,
        statusCode: response.statusCode,
        message: 'Request successful',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Cache Interceptor
```typescript
// interceptors/cache.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();
  private readonly ttl = 60000; // 1 phút

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;

    // Chỉ cache cho GET request
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Kiểm tra cache
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit: ${cacheKey}`);
      return of(cachedResult.data);
    }

    // Nếu không có cache, thực thi và lưu cache
    return next.handle().pipe(
      tap((data) => {
        console.log(`Cache miss: ${cacheKey}`);
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        // Auto clear cache after TTL
        setTimeout(() => {
          this.cache.delete(cacheKey);
        }, this.ttl);
      }),
    );
  }
}
```

### Error Handling Interceptor
```typescript
// interceptors/error.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Log error
        console.error('Error intercepted:', error);

        // Transform error nếu cần
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Convert unknown error thành HTTP exception
        const httpError = new HttpException(
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
            error: 'Something went wrong',
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

        return throwError(() => httpError);
      }),
    );
  }
}
```

### Performance Monitoring Interceptor
```typescript
// interceptors/performance.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(() => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        const { method, url } = request;
        this.logger.log(`${method} ${url} - ${duration.toFixed(2)}ms`);

        // Cảnh báo nếu request chậm
        if (duration > 1000) {
          this.logger.warn(`Slow request detected: ${method} ${url} - ${duration.toFixed(2)}ms`);
        }
      }),
    );
  }
}
```

### Sử dụng Interceptor
```typescript
// users.controller.ts
import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { TransformInterceptor } from '../interceptors/transform.interceptor';

@Controller('users')
@UseInterceptors(LoggingInterceptor, TransformInterceptor) // Apply cho toàn controller
export class UsersController {
  @Get()
  @UseInterceptors(CacheInterceptor) // Apply cho method cụ thể
  findAll() {
    return this.usersService.findAll();
  }
}

// Hoặc global interceptor trong main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ErrorInterceptor(),
  );
  
  await app.listen(3000);
}
```

---

## 4. So sánh Middleware vs Guard vs Interceptor

| Aspect | Middleware | Guard | Interceptor |
|--------|------------|-------|-------------|
| **Thứ tự thực thi** | Đầu tiên | Sau Middleware | Sau Guard |
| **Mục đích chính** | Request preprocessing | Access control | Request/Response transformation |
| **Có thể modify request** | ✅ | ✅ | ✅ |
| **Có thể modify response** | ✅ | ❌ | ✅ |
| **Có thể block request** | ✅ | ✅ | ✅ |
| **Access to response** | ❌ | ❌ | ✅ |
| **RxJS Observable** | ❌ | ❌ | ✅ |

### Khi nào dùng gì?
- **Middleware**: CORS, logging, body parsing, rate limiting
- **Guard**: Authentication, authorization, role checking
- **Interceptor**: Response formatting, caching, performance monitoring, error handling

---

## 5. Ví dụ thực tế: Chat Message Application

### Auth Middleware cho WebSocket
```typescript
// middleware/ws-auth.middleware.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthMiddleware {
  constructor(private jwtService: JwtService) {}

  use(socket: Socket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        throw new Error('Authentication token required');
      }

      const payload = this.jwtService.verify(token);
      socket['user'] = payload;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  }
}
```

### Message Ownership Guard
```typescript
// guards/message-ownership.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class MessageOwnershipGuard implements CanActivate {
  constructor(private messagesService: MessagesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const messageId = request.params.id;

    const message = await this.messagesService.findOne(messageId);
    
    if (!message) {
      return false;
    }

    // Chỉ author của message hoặc admin mới có thể sửa/xóa
    if (message.authorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('You can only modify your own messages');
    }

    return true;
  }
}
```

### Message Transform Interceptor
```typescript
// interceptors/message-transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class MessageTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Transform message response
        if (Array.isArray(data)) {
          return data.map(message => this.transformMessage(message));
        }
        return this.transformMessage(data);
      }),
    );
  }

  private transformMessage(message: any) {
    return {
      ...message,
      // Ẩn thông tin nhạy cảm
      author: {
        id: message.author.id,
        username: message.author.username,
        avatar: message.author.avatar,
        // Không trả về email, phone...
      },
      // Format thời gian
      createdAt: new Date(message.createdAt).toISOString(),
      updatedAt: new Date(message.updatedAt).toISOString(),
    };
  }
}
```

---

## 6. Global vs Local Application

### Global Application
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global middleware (chỉ functional middleware)
  app.use(logger);
  
  // Global guards
  app.useGlobalGuards(new AuthGuard(jwtService));
  
  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );
  
  await app.listen(3000);
}
```

### Module Level Application
```typescript
// app.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard, // Global guard via DI
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // Global interceptor via DI
    },
  ],
})
export class AppModule {}
```

---

## 7. Best Practices

### 1. Tổ chức file
```typescript
src/
├── common/
│   ├── middleware/
│   │   ├── logger.middleware.ts
│   │   ├── cors.middleware.ts
│   │   └── auth.middleware.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── ownership.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── transform.interceptor.ts
│   │   └── cache.interceptor.ts
│   └── decorators/
│       ├── roles.decorator.ts
│       └── user.decorator.ts
```

### 2. Custom Decorator cho User
```typescript
// decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Sử dụng
@Controller('messages')
export class MessagesController {
  @Post()
  create(
    @Body() createMessageDto: CreateMessageDto,
    @User() user: any, // Lấy toàn bộ user
    @User('id') userId: string, // Chỉ lấy user ID
  ) {
    return this.messagesService.create({ ...createMessageDto, authorId: userId });
  }
}
```

### 3. Composite Guards
```typescript
// guards/auth-and-roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Injectable()
export class AuthAndRolesGuard implements CanActivate {
  constructor(
    private authGuard: AuthGuard,
    private rolesGuard: RolesGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Phải pass cả auth và roles
    const isAuthenticated = await this.authGuard.canActivate(context);
    if (!isAuthenticated) return false;

    const hasRequiredRole = await this.rolesGuard.canActivate(context);
    return hasRequiredRole;
  }
}
```

### 4. Error Handling Strategy
```typescript
// Middleware: Log và basic validation
// Guard: Authentication & Authorization
// Interceptor: Transform response và catch errors
// Filter: Handle exceptions và format error response
```

---

**Kết luận**: Middleware, Guard, và Interceptor là 3 lớp quan trọng trong NestJS request lifecycle. Hiểu rõ thứ tự thực thi và mục đích của từng lớp sẽ giúp bạn xây dựng application robust và maintainable.

---
**Tiếp theo: Database Integration (MongoDB/TypeORM)**
