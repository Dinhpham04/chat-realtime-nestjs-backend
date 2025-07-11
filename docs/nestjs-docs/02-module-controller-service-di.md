# 2. Module, Controller, Service, Dependency Injection

## So sánh với Express và Spring Boot

### Express (trước đây)
```javascript
// app.js - tất cả logic trong 1 file
const express = require('express');
const app = express();

app.get('/users', (req, res) => {
  // Logic trực tiếp trong route
  const users = getUsersFromDB();
  res.json(users);
});

app.post('/users', (req, res) => {
  // Logic trực tiếp, khó test, khó tái sử dụng
  const newUser = createUser(req.body);
  res.json(newUser);
});
```

### NestJS (hiện tại)
```typescript
// Tách biệt rõ ràng: Controller -> Service -> Repository
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

---

## 1. Module - Đơn vị tổ chức code

### Module là gì?
- Giống như **package trong Spring Boot** hoặc **folder tổ chức trong Express**.
- Mỗi module quản lý 1 domain/feature cụ thể (users, auth, messages...).
- Module định nghĩa **providers**, **controllers**, **imports**, **exports**.

### Cấu trúc Module
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],    // Import các module khác
  controllers: [UsersController],                 // Các controller trong module
  providers: [UsersService, UsersRepository],     // Các service, repository
  exports: [UsersService],                        // Export để module khác dùng
})
export class UsersModule {}
```

### So sánh với Spring Boot
```java
// Spring Boot - @ComponentScan tự động scan
@SpringBootApplication
@ComponentScan(basePackages = "com.example.users")
public class Application {
    // Tự động inject các @Service, @Repository, @Controller
}
```

```typescript
// NestJS - Khai báo rõ ràng trong module
@Module({
  providers: [UsersService, UsersRepository],  // Giống @Service, @Repository
  controllers: [UsersController],              // Giống @RestController
})
export class UsersModule {}
```

### Ví dụ thực tế: UsersModule
```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Đăng ký entity User cho TypeORM
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export để AuthModule có thể dùng
})
export class UsersModule {}
```

---

## 2. Controller - HTTP Layer

### Controller là gì?
- Giống **@RestController trong Spring Boot**.
- Nhận HTTP request, gọi service, trả response.
- **KHÔNG chứa business logic**, chỉ validate input và format output.

### Decorators cơ bản
```typescript
@Controller('users')           // Base route: /users
export class UsersController {
  
  @Get()                      // GET /users
  findAll() { ... }
  
  @Get(':id')                 // GET /users/:id
  findOne(@Param('id') id: string) { ... }
  
  @Post()                     // POST /users
  create(@Body() createUserDto: CreateUserDto) { ... }
  
  @Put(':id')                 // PUT /users/:id
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) { ... }
  
  @Delete(':id')              // DELETE /users/:id
  remove(@Param('id') id: string) { ... }
}
```

### So sánh với Express
```javascript
// Express - Route trực tiếp
app.get('/users', (req, res) => {
  // Logic trực tiếp ở đây
});

app.post('/users', (req, res) => {
  // Validate manually
  if (!req.body.email) {
    return res.status(400).json({ error: 'Email required' });
  }
  // Logic ở đây
});
```

```typescript
// NestJS - Tách biệt, tự động validate
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {} // DI tự động
  
  @Post()
  create(@Body() createUserDto: CreateUserDto) { // Tự động validate DTO
    return this.usersService.create(createUserDto);
  }
}
```

### Ví dụ đầy đủ UsersController
```typescript
// users/users.controller.ts
import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

---

## 3. Service - Business Logic Layer

### Service là gì?
- Giống **@Service trong Spring Boot**.
- Chứa toàn bộ business logic.
- Có thể inject các service khác, repository, external API...

### Khai báo Service
```typescript
@Injectable()  // Báo cho NestJS biết đây là provider có thể inject
export class UsersService {
  constructor(
    private usersRepository: UsersRepository,  // Inject repository
    private emailService: EmailService,       // Inject service khác
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Business logic ở đây
    const existingUser = await this.usersRepository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    // Gửi email welcome
    await this.emailService.sendWelcomeEmail(user.email);
    
    return user;
  }
}
```

### So sánh với Express
```javascript
// Express - Logic lẫn lộn với route
app.post('/users', async (req, res) => {
  // Validate
  if (!req.body.email) return res.status(400).json({...});
  
  // Business logic
  const existingUser = await db.findUserByEmail(req.body.email);
  if (existingUser) return res.status(409).json({...});
  
  // Create user
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const user = await db.createUser({...req.body, password: hashedPassword});
  
  // Send email
  await emailService.sendWelcome(user.email);
  
  res.json(user);
});
```

```typescript
// NestJS - Tách biệt rõ ràng
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  
  @Post()
  create(@Body() createUserDto: CreateUserDto) { // Validation tự động
    return this.usersService.create(createUserDto); // Business logic ở service
  }
}

@Injectable()
export class UsersService {
  // Business logic tập trung, dễ test, dễ tái sử dụng
}
```

### Ví dụ đầy đủ UsersService
```typescript
// users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Kiểm tra email đã tồn tại
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email }
    });
    
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Tạo user mới
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return await this.usersRepository.save(user);
  }

  async findAll(paginationDto: PaginationDto): Promise<{ data: User[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    
    const [data, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'username', 'email', 'fullName', 'createdAt'], // Không trả password
    });

    return { data, total };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'username', 'email', 'fullName', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // Kiểm tra user tồn tại

    // Nếu update password, hash lại
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    await this.usersRepository.update(id, updateUserDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id); // Kiểm tra user tồn tại
    await this.usersRepository.remove(user);
  }

  // Method để AuthService sử dụng
  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'username'], // Include password để check login
    });
  }
}
```

---

## 4. Dependency Injection (DI)

### DI là gì?
- Giống **@Autowired trong Spring Boot**.
- NestJS tự động tạo instance và inject vào constructor.
- Giúp code loose coupling, dễ test, dễ mock.

### Cách hoạt động
```typescript
// 1. Khai báo provider trong module
@Module({
  providers: [UsersService, EmailService], // NestJS sẽ tạo singleton instance
})

// 2. Inject vào constructor
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,    // Tự động inject
    private emailService: EmailService,   // Tự động inject
  ) {}
}
```

### So sánh với cách cũ
```javascript
// Express - Manual dependency
const usersService = require('./users.service');
const emailService = require('./email.service');

app.post('/users', (req, res) => {
  // Manually call service
  usersService.create(req.body);
});
```

```typescript
// NestJS - Automatic injection
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {} // Tự động inject
  
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto); // Sử dụng
  }
}
```

### Custom Providers
```typescript
// Inject với custom token
const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useValue: connectionInstance,
    },
    {
      provide: 'CONFIG',
      useFactory: () => ({
        apiKey: process.env.API_KEY,
      }),
    },
  ],
})

// Sử dụng
@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION) private db: Connection,
    @Inject('CONFIG') private config: any,
  ) {}
}
```

---

## 5. Lắp ráp tất cả lại

### File cấu trúc hoàn chỉnh
```
src/
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── app.module.ts
└── main.ts
```

### app.module.ts - Root module
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'messaging_app',
      autoLoadEntities: true,
      synchronize: true, // Chỉ dùng trong dev
    }),
    UsersModule,  // Import UsersModule
    AuthModule,   // Import AuthModule
  ],
})
export class AppModule {}
```

### main.ts - Bootstrap app
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,  // Loại bỏ property không có trong DTO
    transform: true,  // Tự động transform type
  }));
  
  await app.listen(3000);
}
bootstrap();
```

---

## 6. Lợi ích của cách tiếp cận này

### Testability
```typescript
// Easy to mock dependencies
describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository, // Mock repository
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });
});
```

### Maintainability
- Code tách biệt rõ ràng, dễ đọc, dễ sửa.
- Thay đổi business logic chỉ cần sửa service.
- Thay đổi API chỉ cần sửa controller.

### Scalability
- Dễ dàng thêm module mới.
- Service có thể tái sử dụng ở nhiều controller.
- Dễ chuyển sang microservice.

---

## 7. Best Practices

1. **Controller chỉ làm HTTP layer**:
   - Validate input (dùng DTO)
   - Gọi service
   - Format response

2. **Service chứa business logic**:
   - Validation business rules
   - Orchestrate các thao tác
   - Handle exceptions

3. **Sử dụng DTO cho mọi input/output**:
   - Type safety
   - Validation tự động
   - Documentation

4. **Async/await everywhere**:
   - Database operations
   - External API calls
   - File operations

---
Tiếp theo: **DTO, Validation, Pipes**
