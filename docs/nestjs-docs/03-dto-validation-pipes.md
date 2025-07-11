# 3. DTO, Validation, Pipes

## Tại sao cần DTO và Validation?

### Vấn đề với Express (cách cũ)
```javascript
// Express - Không có type safety, validation thủ công
app.post('/users', (req, res) => {
  // Validation thủ công, dễ quên, dễ sai
  if (!req.body.email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!req.body.email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  if (req.body.age && typeof req.body.age !== 'number') {
    return res.status(400).json({ error: 'Age must be a number' });
  }
  
  // Có thể nhận thêm field không mong muốn
  console.log(req.body); // { email: 'test@test.com', maliciousField: 'hack' }
  
  // Logic tiếp theo...
});
```

### NestJS với DTO và Validation
```typescript
// Tự động validate, type-safe, clean code
@Controller('users')
export class UsersController {
  @Post()
  create(@Body() createUserDto: CreateUserDto) { // Tự động validate
    // Chỉ nhận đúng field trong DTO, loại bỏ field không mong muốn
    return this.usersService.create(createUserDto);
  }
}
```

---

## 1. DTO (Data Transfer Object) là gì?

### Định nghĩa
- **DTO** là object định nghĩa **cấu trúc dữ liệu** được truyền giữa client và server.
- Giống như **Request/Response model** trong Spring Boot.
- Đảm bảo **type safety** và **data validation**.

### Lợi ích của DTO
1. **Type Safety**: TypeScript kiểm tra type tại compile time
2. **Validation**: Tự động validate dữ liệu
3. **Documentation**: Tự động generate API docs
4. **Security**: Chỉ nhận field được định nghĩa (whitelist)
5. **Maintainability**: Dễ thay đổi, refactor

### Ví dụ cơ bản
```typescript
// dto/create-user.dto.ts
export class CreateUserDto {
  email: string;
  username: string;
  password: string;
  fullName: string;
  age?: number; // Optional field
}
```

---

## 2. Class-validator - Validation mạnh mẽ

### Cài đặt
```bash
npm install class-validator class-transformer
```

### Các decorator validation phổ biến
```typescript
import { 
  IsEmail, 
  IsString, 
  IsInt, 
  IsOptional, 
  MinLength, 
  MaxLength,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsDateString,
  Matches
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email phải đúng định dạng' })
  email: string;

  @IsString({ message: 'Username phải là chuỗi' })
  @MinLength(3, { message: 'Username tối thiểu 3 ký tự' })
  @MaxLength(20, { message: 'Username tối đa 20 ký tự' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Password tối thiểu 6 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số'
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsOptional() // Field không bắt buộc
  @IsInt({ message: 'Tuổi phải là số nguyên' })
  @Min(13, { message: 'Tuổi tối thiểu 13' })
  @Max(120, { message: 'Tuổi tối đa 120' })
  age?: number;
}
```

### Validation nâng cao
```typescript
import { IsEnum, IsArray, ValidateNested, Type } from 'class-validator';

// Enum validation
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export class CreateUserDto {
  // ...other fields

  @IsEnum(UserRole, { message: 'Role phải là admin, user hoặc moderator' })
  role: UserRole;

  @IsArray({ message: 'Tags phải là array' })
  @IsString({ each: true, message: 'Mỗi tag phải là string' })
  tags: string[];

  @IsOptional()
  @IsDateString({}, { message: 'Birthday phải đúng format ISO date' })
  birthday?: string;
}

// Nested object validation
export class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  country: string;
}

export class CreateUserWithAddressDto {
  @IsEmail()
  email: string;

  @ValidateNested() // Validate nested object
  @Type(() => AddressDto) // Transform plain object to class
  address: AddressDto;
}
```

---

## 3. Các loại DTO thường dùng

### CreateDto - Tạo mới
```typescript
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsString()
  phone?: string;
}
```

### UpdateDto - Cập nhật (partial)
```typescript
// dto/update-user.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Cách 1: Tất cả field optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// Cách 2: Loại bỏ một số field
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const) // Không cho update email
) {}

// Cách 3: Custom update DTO
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsInt()
  @Min(13)
  @Max(120)
  age?: number;

  // Email và password không cho phép update ở đây
}
```

### QueryDto - Query parameters
```typescript
// dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max, Type } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number) // Transform string to number
  @IsInt({ message: 'Page phải là số nguyên' })
  @Min(1, { message: 'Page tối thiểu là 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'Limit tối đa 100' })
  limit?: number = 10;
}

// dto/search-user.dto.ts
export class SearchUserDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  keyword?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(13)
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(120)
  maxAge?: number;
}
```

### ResponseDto - Response format
```typescript
// dto/user-response.dto.ts
import { Exclude, Expose, Transform } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  username: string;

  @Expose()
  fullName: string;

  @Expose()
  age: number;

  @Expose()
  @Transform(({ value }) => value?.toISOString()) // Transform Date to ISO string
  createdAt: Date;

  @Exclude() // Không trả password trong response
  password: string;

  @Exclude()
  deletedAt: Date;
}

// dto/paginated-response.dto.ts
export class PaginatedResponseDto<T> {
  data: T[]; // mảng có kiểu generic
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
```

---

## 4. Pipes - Transform và Validate dữ liệu

### Pipes là gì?
- **Pipes** chạy **trước khi** request đến controller method.
- Có 2 nhiệm vụ chính:
  1. **Transformation**: Transform input data (string -> number, plain object -> class instance)
  2. **Validation**: Validate input data theo DTO

### Built-in Pipes
```typescript
import { 
  ValidationPipe, 
  ParseIntPipe, 
  ParseBoolPipe, 
  ParseArrayPipe,
  ParseUUIDPipe 
} from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { // Transform string -> number
    return this.usersService.findOne(id);
  }

  @Get(':uuid')
  findByUuid(@Param('uuid', ParseUUIDPipe) uuid: string) { // Validate UUID format
    return this.usersService.findByUuid(uuid);
  }

  @Get()
  findAll(
    @Query('active', ParseBoolPipe) active: boolean, // Transform "true" -> true
    @Query('tags', ParseArrayPipe) tags: string[]   // Transform "tag1,tag2" -> ["tag1", "tag2"]
  ) {
    return this.usersService.findAll({ active, tags });
  }
}
```

### ValidationPipe - Quan trọng nhất
```typescript
// Global validation pipe trong main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    // Tự động loại bỏ property không có trong DTO
    whitelist: true,
    
    // Throw error nếu có property không được phép
    forbidNonWhitelisted: true,
    
    // Tự động transform type (string -> number, plain object -> class instance)
    transform: true,
    
    // Transform query/param từ string
    transformOptions: {
      enableImplicitConversion: true, // truyển đổi ngầm định
    },
    
    // Custom error message format
    exceptionFactory: (errors) => {
      const messages = errors.map(error => 
        Object.values(error.constraints || {}).join(', ')
      );
      return new BadRequestException(messages.join('; '));
    }
  }));
  
  await app.listen(3000);
}
```

### Validation Pipe cho từng endpoint
```typescript
@Controller('users')
export class UsersController {
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
  
  // Hoặc chỉ validate body
  @Post('simple')
  createSimple(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

---

## 5. Custom Validation

### Custom Validator Decorator
```typescript
// validators/is-username-unique.validator.ts
import { 
  registerDecorator, 
  ValidationOptions, 
  ValidatorConstraint, 
  ValidatorConstraintInterface,
  ValidationArguments 
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@ValidatorConstraint({ name: 'IsUsernameUnique', async: true }) // tạo ra một dàng buộc xác thực giống như @isInt, cho phép sử dụng async
@Injectable()
export class IsUsernameUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private usersService: UsersService) {}

    // Hàm validate sẽ được gọi khi sử dụng decorator
  async validate(username: string, args: ValidationArguments) {
    const user = await this.usersService.findByUsername(username);
    return !user; // Return false if user exists (validation fails)
  }

    // Hàm này sẽ trả về thông báo lỗi nếu validation fails
  defaultMessage(args: ValidationArguments) {
    return 'Username "$value" đã tồn tại';
  }
}

// Decorator function
export function IsUsernameUnique(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUsernameUniqueConstraint,
    });
  };
}
```

### Sử dụng Custom Validator
```typescript
// dto/create-user.dto.ts
import { IsUsernameUnique } from '../validators/is-username-unique.validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @IsUsernameUnique() // Custom validator
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

### Custom Pipe
```typescript
// pipes/password-hash.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordHashPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value.password) {
      // Hash password trước khi đến controller
      value.password = await bcrypt.hash(value.password, 10);
    }
    return value;
  }
}

// Sử dụng
@Post()
create(@Body(PasswordHashPipe) createUserDto: CreateUserDto) {
  // createUserDto.password đã được hash
  return this.usersService.create(createUserDto);
}
```

---

## 6. File Upload với Validation

### Upload single file
```typescript
// dto/upload-avatar.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class UploadAvatarDto {
  @IsOptional()
  @IsString()
  alt?: string; // Alt text for image
}
```

```typescript
// controllers/users.controller.ts
import { 
  Controller, 
  Post, 
  UseInterceptors, 
  UploadedFile, 
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadAvatarDto } from './dto/upload-avatar.dto';

@Controller('users')
export class UsersController {
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif)$/ }),
        ],
      })
    ) file: Express.Multer.File,
    @Body() uploadAvatarDto: UploadAvatarDto
  ) {
    return this.usersService.uploadAvatar(file, uploadAvatarDto);
  }
}
```

### Upload multiple files
```typescript
@Post('gallery')
@UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
uploadGallery(
  @UploadedFiles(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB per file
        new FileTypeValidator({ fileType: 'image/*' }),
      ],
    })
  ) files: Express.Multer.File[]
) {
  return this.usersService.uploadGallery(files);
}
```

---

## 7. Error Handling với Validation

### Custom Exception Filter
```typescript
// filters/validation-exception.filter.ts
import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  BadRequestException 
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Format validation errors
    let errors = [];
    if (typeof exceptionResponse === 'object' && exceptionResponse['message']) {
      errors = Array.isArray(exceptionResponse['message']) 
        ? exceptionResponse['message'] 
        : [exceptionResponse['message']];
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: 'Validation failed',
      errors: errors,
    });
  }
}
```

### Error Response Format
```typescript
// Khi validation fails, response sẽ như sau:
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "Validation failed",
  "errors": [
    "Email không đúng định dạng",
    "Username tối thiểu 3 ký tự",
    "Password phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số"
  ]
}
```

---

## 8. Testing DTO và Validation

### Unit test cho DTO validation
```typescript
// tests/dto/create-user.dto.spec.ts
import { validate } from 'class-validator';
import { CreateUserDto } from '../src/users/dto/create-user.dto';

describe('CreateUserDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = new CreateUserDto();
    dto.email = 'test@example.com';
    dto.username = 'testuser';
    dto.password = 'Password123';
    dto.fullName = 'Test User';
    dto.age = 25;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail validation with invalid email', async () => {
    const dto = new CreateUserDto();
    dto.email = 'invalid-email'; // Invalid email
    dto.username = 'testuser';
    dto.password = 'Password123';
    dto.fullName = 'Test User';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
    expect(errors[0].constraints?.isEmail).toBeDefined();
  });

  it('should fail validation with short password', async () => {
    const dto = new CreateUserDto();
    dto.email = 'test@example.com';
    dto.username = 'testuser';
    dto.password = '123'; // Too short
    dto.fullName = 'Test User';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });
});
```

---

## 9. Best Practices

### 1. Tổ chức DTO
```typescript
// Tách biệt DTO theo chức năng
src/
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   ├── search-user.dto.ts
│   │   ├── user-response.dto.ts
│   │   └── upload-avatar.dto.ts
│   └── ...
├── common/
│   ├── dto/
│   │   ├── pagination.dto.ts
│   │   └── id-param.dto.ts
│   └── ...
```

### 2. Sử dụng Mapped Types
```typescript
// Tái sử dụng DTO với mapped types
import { PartialType, PickType, OmitType, IntersectionType } from '@nestjs/mapped-types';

// Update DTO (tất cả field optional)
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// Login DTO (chỉ lấy email và password)
export class LoginDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}

// Public User DTO (loại bỏ password)
export class PublicUserDto extends OmitType(CreateUserDto, ['password'] as const) {}

// Search with pagination
export class SearchUserDto extends IntersectionType(
  PartialType(PickType(CreateUserDto, ['fullName', 'age'] as const)),
  PaginationDto
) {}
```

### 3. Custom Error Messages
```typescript
export class CreateUserDto {
  @IsEmail({}, { 
    message: 'Vui lòng nhập email đúng định dạng (ví dụ: user@example.com)' 
  })
  email: string;

  @IsString({ message: 'Username phải là chuỗi ký tự' })
  @MinLength(3, { message: 'Username phải có ít nhất 3 ký tự' })
  @MaxLength(20, { message: 'Username không được quá 20 ký tự' })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới' 
  })
  username: string;
}
```

### 4. Validation Groups
```typescript
import { IsString, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @ValidateIf(o => o.loginType === 'email') // Chỉ validate khi loginType là 'email'
  email?: string;

  @IsString()
  @ValidateIf(o => o.loginType === 'phone')
  phone?: string;

  @IsString()
  loginType: 'email' | 'phone';
}
```

---

## 10. Ví dụ thực tế hoàn chỉnh

### CreateUserDto với validation đầy đủ
```typescript
// dto/create-user.dto.ts
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  IsOptional, 
  IsInt, 
  Min, 
  Max,
  Matches,
  IsEnum,
  IsPhoneNumber
} from 'class-validator';

enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Email phải đúng định dạng' })
  email: string;

  @IsString({ message: 'Username phải là chuỗi' })
  @MinLength(3, { message: 'Username tối thiểu 3 ký tự' })
  @MaxLength(20, { message: 'Username tối đa 20 ký tự' })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: 'Username chỉ chứa chữ cái, số và dấu gạch dưới' 
  })
  username: string;

  @IsString({ message: 'Password phải là chuỗi' })
  @MinLength(8, { message: 'Password tối thiểu 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt'
  })
  password: string;

  @IsString({ message: 'Họ tên phải là chuỗi' })
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' })
  fullName: string;

  @IsOptional()
  @IsInt({ message: 'Tuổi phải là số nguyên' })
  @Min(13, { message: 'Tuổi tối thiểu 13' })
  @Max(120, { message: 'Tuổi tối đa 120' })
  age?: number;

  @IsOptional()
  @IsPhoneNumber('VN', { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role phải là user, admin hoặc moderator' })
  role?: UserRole = UserRole.USER;
}
```

### Controller sử dụng DTO
```typescript
// users.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  Put, 
  Delete,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';
import { IdParamDto } from '../common/dto/id-param.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(@Query() searchUserDto: SearchUserDto) {
    return this.usersService.findAll(searchUserDto);
  }

  @Get(':id')
  findOne(@Param() { id }: IdParamDto) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(
    @Param() { id }: IdParamDto,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param() { id }: IdParamDto) {
    return this.usersService.remove(id);
  }
}
```

---

**Kết luận**: DTO và Validation là nền tảng quan trọng trong NestJS, giúp đảm bảo data integrity, type safety và security. Việc sử dụng đúng sẽ giúp code clean, maintainable và ít bug hơn.

---
**Tiếp theo: Database Integration (MongoDB/TypeORM)**
