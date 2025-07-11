# 8. NestJS Fundamentals - Core Concepts

## Tổng quan về NestJS

NestJS là một framework để xây dựng server-side applications với Node.js. Được xây dựng với TypeScript và kết hợp các yếu tố tốt nhất từ OOP (Object Oriented Programming), FP (Functional Programming), và FRP (Functional Reactive Programming).

### Triết lý thiết kế
- **Modular**: Ứng dụng được tổ chức thành các module
- **Decorator-based**: Sử dụng decorators để metadata và configuration
- **Dependency Injection**: IoC container mạnh mẽ
- **Platform-agnostic**: Có thể chạy trên Express hoặc Fastify

---

## 1. Controllers

Controllers chịu trách nhiệm xử lý các incoming requests và trả về responses cho client.

### Basic Controller
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(): string {
    return 'This action returns all cats';
  }
}
```

**Giải thích:**
- `@Controller('cats')`: Định nghĩa route prefix là `/cats`
- `@Get()`: HTTP GET method decorator
- Method `findAll()` sẽ handle GET `/cats`

### Request Object
```typescript
import { Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(@Req() request: Request): string {
    // Access Express request object
    console.log(request.headers);
    return 'This action returns all cats';
  }
}
```

### Route Parameters
```typescript
@Controller('cats')
export class CatsController {
  @Get(':id')
  findOne(@Param('id') id: string): string {
    return `This action returns a #${id} cat`;
  }

  @Get(':id/owner/:ownerId')
  findCatOwner(
    @Param('id') catId: string,
    @Param('ownerId') ownerId: string,
  ): string {
    return `Cat ${catId} belongs to owner ${ownerId}`;
  }

  // Lấy tất cả params
  @Get('search/:category/:type')
  search(@Param() params: any): string {
    return `Searching for ${params.category} of type ${params.type}`;
  }
}
```

### Request Body
```typescript
export class CreateCatDto {
  name: string;
  age: number;
  breed: string;
}

@Controller('cats')
export class CatsController {
  @Post()
  create(@Body() createCatDto: CreateCatDto): string {
    return `Creating cat: ${createCatDto.name}`;
  }

  // Lấy specific property từ body
  @Post('bulk')
  createBulk(@Body('cats') cats: CreateCatDto[]): string {
    return `Creating ${cats.length} cats`;
  }
}
```

### Query Parameters
```typescript
@Controller('cats')
export class CatsController {
  @Get()
  findAll(
    @Query('limit') limit: string,
    @Query('offset') offset: string,
  ): string {
    return `Limit: ${limit}, Offset: ${offset}`;
  }

  // Lấy tất cả query params
  @Get('search')
  search(@Query() query: any): string {
    return `Searching with: ${JSON.stringify(query)}`;
  }
}
```

### Headers
```typescript
@Controller('cats')
export class CatsController {
  @Get()
  findAll(@Headers('authorization') auth: string): string {
    return `Auth header: ${auth}`;
  }

  // Lấy tất cả headers
  @Get('info')
  getInfo(@Headers() headers: any): string {
    return `Headers: ${JSON.stringify(headers)}`;
  }
}
```

### HTTP Status Codes
```typescript
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT) // 204
  create(): void {
    // Create cat logic
  }

  @Get()
  @HttpCode(200) // Explicit 200
  findAll(): string {
    return 'All cats';
  }
}
```

### Response Headers
```typescript
import { Controller, Post, Header } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Post()
  @Header('Cache-Control', 'none')
  create(): string {
    return 'Cat created';
  }
}
```

### Redirection
```typescript
import { Controller, Get, Redirect } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get('docs')
  @Redirect('https://docs.nestjs.com', 302)
  getDocs(@Query('version') version) {
    if (version && version === '5') {
      return { url: 'https://docs.nestjs.com/v5/' };
    }
  }
}
```

### Route Wildcards
```typescript
@Controller('cats')
export class CatsController {
  @Get('ab*cd')
  findAll() {
    return 'This route uses a wildcard';
  }
}
```
Matches: `abcd`, `ab_cd`, `abecd`, etc.

### Sub-Domain Routing
```typescript
@Controller({ host: 'admin.example.com' })
export class AdminController {
  @Get()
  index(): string {
    return 'Admin page';
  }
}

@Controller({ host: ':account.example.com' })
export class AccountController {
  @Get()
  getInfo(@HostParam('account') account: string): string {
    return `Account: ${account}`;
  }
}
```

### Async Controllers
```typescript
@Controller('cats')
export class CatsController {
  @Get()
  async findAll(): Promise<any[]> {
    return []; // Simulate async operation
  }

  @Get('observable')
  findAllRx(): Observable<any[]> {
    return of([]); // Using RxJS Observable
  }
}
```

---

## 2. Providers

Providers là một khái niệm cơ bản trong NestJS. Nhiều classes cơ bản có thể được coi là provider - services, repositories, factories, helpers, etc.

### Basic Service
```typescript
import { Injectable } from '@nestjs/common';

export interface Cat {
  name: string;
  age: number;
  breed: string;
}

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [];

  create(cat: Cat) {
    this.cats.push(cat);
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    return this.cats[id];
  }

  update(id: number, cat: Cat) {
    this.cats[id] = cat;
  }

  remove(id: number) {
    this.cats.splice(id, 1);
  }
}
```

**Giải thích:**
- `@Injectable()`: Decorator đánh dấu class có thể được inject
- Service chứa business logic
- Controller sẽ inject service này

### Using Service in Controller
```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CatsService } from './cats.service';
import { Cat } from './interfaces/cat.interface';

@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Post()
  async create(@Body() createCatDto: Cat) {
    this.catsService.create(createCatDto);
  }

  @Get()
  async findAll(): Promise<Cat[]> {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Cat {
    return this.catsService.findOne(+id);
  }
}
```

### Dependency Injection Scopes
```typescript
import { Injectable, Scope } from '@nestjs/common';

// DEFAULT: Singleton (recommended)
@Injectable()
export class CatsService {}

// REQUEST: New instance per request
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {}

// TRANSIENT: New instance every time it's injected
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

### Custom Providers

#### Value Provider
```typescript
// Provide a value
const mockCatsService = {
  findAll: () => ['cat1', 'cat2'],
};

@Module({
  providers: [
    {
      provide: CatsService,
      useValue: mockCatsService,
    },
  ],
})
export class AppModule {}
```

#### Class Provider
```typescript
// Use different class
@Injectable()
export class AlternativeCatsService {}

@Module({
  providers: [
    {
      provide: CatsService,
      useClass: AlternativeCatsService,
    },
  ],
})
export class AppModule {}
```

#### Factory Provider
```typescript
@Module({
  providers: [
    {
      provide: 'CONNECTION',
      useFactory: (configService: ConfigService) => {
        const options = configService.get('database');
        return new DatabaseConnection(options);
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

#### Alias Provider
```typescript
@Module({
  providers: [
    CatsService,
    {
      provide: 'CATS_SERVICE',
      useExisting: CatsService,
    },
  ],
})
export class AppModule {}
```

### Optional Providers
```typescript
import { Injectable, Optional, Inject } from '@nestjs/common';

@Injectable()
export class HttpService {
  constructor(@Optional() @Inject('HTTP_OPTIONS') private httpClient) {}
}
```

### Property-based Injection
```typescript
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class HttpService {
  @Inject('HTTP_OPTIONS')
  private readonly httpClient;
}
```

---

## 3. Modules

Module là một class được trang trí với `@Module()` decorator. Module cung cấp metadata mà NestJS sử dụng để tổ chức cấu trúc ứng dụng.

### Basic Module
```typescript
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}
```

### Feature Module
```typescript
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService], // Export để modules khác có thể import
})
export class CatsModule {}
```

### Shared Module
```typescript
import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global() // Làm cho module available globally
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

### Dynamic Module
```typescript
import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({})
export class ConfigModule {
  static forRoot(options: any): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: options,
        },
        ConfigService,
      ],
      exports: [ConfigService],
      global: true,
    };
  }
}

// Usage
@Module({
  imports: [
    ConfigModule.forRoot({
      folder: './config',
    }),
  ],
})
export class AppModule {}
```

### Module Re-exporting
```typescript
@Module({
  imports: [CommonModule],
  exports: [CommonModule], // Re-export CommonModule
})
export class CoreModule {}
```

---

## 4. Middleware

Middleware là một function được gọi trước route handler. Có thể access request, response objects và next middleware function.

### Function Middleware
```typescript
import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.url}`);
  next();
}
```

### Class Middleware
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  }
}
```

### Applying Middleware
```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CatsModule } from './cats/cats.module';

@Module({
  imports: [CatsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('cats'); // Apply to specific routes
  }
}
```

### Route-specific Middleware
```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        { path: 'cats', method: RequestMethod.GET },
        { path: 'cats', method: RequestMethod.POST },
        'cats/(.*)', // Wildcard
      )
      .forRoutes(CatsController);
  }
}
```

### Multiple Middleware
```typescript
consumer
  .apply(cors(), helmet(), logger)
  .forRoutes(CatsController);
```

### Middleware with Dependencies
```typescript
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization;
    const isValid = await this.authService.validateToken(token);
    
    if (!isValid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    next();
  }
}
```

---

## 5. Exception Filters

Exception filters handle tất cả unhandled exceptions trong application.

### Built-in HTTP Exception
```typescript
import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  async findAll() {
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  @Get('error')
  async throwError() {
    throw new HttpException(
      {
        status: HttpStatus.FORBIDDEN,
        error: 'This is a custom message',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
```

### Built-in Exceptions
```typescript
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  NotAcceptableException,
  RequestTimeoutException,
  ConflictException,
  GoneException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  InternalServerErrorException,
  NotImplementedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException,
} from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get('bad-request')
  badRequest() {
    throw new BadRequestException('Something bad happened');
  }

  @Get('unauthorized')
  unauthorized() {
    throw new UnauthorizedException();
  }

  @Get('not-found')
  notFound() {
    throw new NotFoundException('Cat not found');
  }
}
```

### Custom Exception Filter
```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception.message,
    });
  }
}
```

### Catch All Exceptions
```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof HttpException 
        ? exception.message 
        : 'Internal server error',
    });
  }
}
```

### Binding Filters

#### Method Level
```typescript
@Post()
@UseFilters(new HttpExceptionFilter())
async create(@Body() createCatDto: CreateCatDto) {
  throw new ForbiddenException();
}
```

#### Controller Level
```typescript
@UseFilters(new HttpExceptionFilter())
@Controller('cats')
export class CatsController {}
```

#### Global Level
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(3000);
}
```

#### Global Filter with Dependencies
```typescript
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
```

---

## 6. Pipes

Pipes có hai typical use cases:
- **Transformation**: transform input data thành desired form
- **Validation**: evaluate input data và throw exception nếu invalid

### Built-in Pipes
```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catsService.findOne(id);
  }

  @Get('by-uuid/:id')
  async findByUuid(@Param('id', ParseUUIDPipe) id: string) {
    return this.catsService.findByUuid(id);
  }

  @Post()
  async create(@Body(ValidationPipe) createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }
}
```

### Custom Validation Pipe
```typescript
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Validation failed');
    }
    return val;
  }
}
```

### Schema-based Validation
```typescript
import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ObjectSchema } from 'joi';

@Injectable()
export class JoiValidationPipe implements PipeTransform {
  constructor(private schema: ObjectSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const { error } = this.schema.validate(value);
    if (error) {
      throw new BadRequestException('Validation failed');
    }
    return value;
  }
}

// Usage
@Post()
@UsePipes(new JoiValidationPipe(createCatSchema))
async create(@Body() createCatDto: CreateCatDto) {
  this.catsService.create(createCatDto);
}
```

### Class Validator
```bash
npm i --save class-validator class-transformer
```

```typescript
// create-cat.dto.ts
import { IsString, IsInt, Min, Max } from 'class-validator';

export class CreateCatDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(20)
  age: number;

  @IsString()
  breed: string;
}
```

```typescript
// Using ValidationPipe globally
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
```

### Transformation Pipe
```typescript
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Validation failed');
    }
    return val;
  }
}
```

### Providing Default Values
```typescript
@Get()
async findAll(
  @Query('activeOnly', new DefaultValuePipe(false), ParseBoolPipe) 
  activeOnly: boolean,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) 
  page: number,
) {
  return this.catsService.findAll({ activeOnly, page });
}
```

---

## 7. Guards

Guards có một single responsibility: chúng determine liệu request sẽ được handled bởi route handler hay không, tùy thuộc vào conditions.

### Authorization Guard
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  private validateRequest(request: any): boolean {
    // Authentication logic
    return request.headers.authorization === 'valid-token';
  }
}
```

### Role-based Guard
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return this.matchRoles(roles, user.roles);
  }

  private matchRoles(roles: string[], userRoles: string[]): boolean {
    return roles.some(role => userRoles.includes(role));
  }
}
```

### Setting up Metadata
```typescript
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Usage
@Post()
@Roles('admin')
async create(@Body() createCatDto: CreateCatDto) {
  this.catsService.create(createCatDto);
}
```

### Binding Guards

#### Controller Level
```typescript
@Controller('cats')
@UseGuards(RolesGuard)
export class CatsController {}
```

#### Method Level
```typescript
@Post()
@UseGuards(AuthGuard, RolesGuard)
async create(@Body() createCatDto: CreateCatDto) {
  this.catsService.create(createCatDto);
}
```

#### Global Guards
```typescript
const app = await NestFactory.create(AppModule);
app.useGlobalGuards(new RolesGuard());
```

#### Global Guard with Dependencies
```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
```

---

## 8. Interceptors

Interceptors có thể:
- Bind extra logic trước/sau method execution
- Transform result từ function
- Transform exception từ function
- Extend behavior của function
- Override function (caching)

### Basic Interceptor
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Before...');

    const now = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => console.log(`After... ${Date.now() - now}ms`)),
      );
  }
}
```

### Response Mapping
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(map(data => ({ data })));
  }
}
```

### Exception Mapping
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  BadGatewayException,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next
      .handle()
      .pipe(
        catchError(err => throwError(new BadGatewayException())),
      );
  }
}
```

### Cache Interceptor
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isCached = true;
    if (isCached) {
      return of([]); // Return cached data
    }
    return next.handle();
  }
}
```

### Timeout Interceptor
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => {
        if (err instanceof TimeoutError) {
          return throwError(new RequestTimeoutException());
        }
        return throwError(err);
      }),
    );
  }
}
```

### Binding Interceptors

#### Controller Level
```typescript
@UseInterceptors(LoggingInterceptor)
export class CatsController {}
```

#### Method Level
```typescript
@UseInterceptors(LoggingInterceptor)
@Get()
findAll() {
  return this.catsService.findAll();
}
```

#### Global Interceptors
```typescript
const app = await NestFactory.create(AppModule);
app.useGlobalInterceptors(new LoggingInterceptor());
```

---

## 9. Custom Decorators

NestJS được xây dựng trên decorators. Bạn có thể tạo custom decorators.

### Param Decorators
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage
@Get()
async findOne(@User() user: UserEntity) {
  console.log(user);
}
```

### Passing Data
```typescript
export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Usage
@Get()
async findOne(@User('firstName') firstName: string) {
  console.log(`Hello ${firstName}`);
}
```

### Working with Pipes
```typescript
@Get()
async findOne(
  @User(new ValidationPipe({ validateCustomDecorators: true }))
  user: UserEntity,
) {
  console.log(user);
}
```

### Decorator Composition
```typescript
import { applyDecorators } from '@nestjs/common';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  );
}

// Usage
@Get('users')
@Auth('admin')
findAllUsers() {}
```

---

**Tóm tắt NestJS Fundamentals:**

1. **Controllers**: Handle HTTP requests, route parameters, query params, body
2. **Providers**: Services với dependency injection, custom providers
3. **Modules**: Tổ chức application structure, feature modules, dynamic modules
4. **Middleware**: Pre-processing requests, logging, authentication
5. **Exception Filters**: Handle errors, custom error responses
6. **Pipes**: Data transformation và validation
7. **Guards**: Authorization, role-based access control
8. **Interceptors**: AOP programming, logging, caching, transformation
9. **Custom Decorators**: Tạo decorators tùy chỉnh, decorator composition

Những concepts này là foundation để xây dựng scalable NestJS applications!
