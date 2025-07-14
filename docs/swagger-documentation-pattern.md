# Swagger Documentation Pattern - Clean Architecture

## Vấn đề trước khi refactor

Trước đây, controller có quá nhiều Swagger decorators làm code rất rối:

```typescript
@Controller('auth')
export class AuthController {
  @Post('register')
  @ApiOperation({
    summary: 'Register new user account',
    description: `
## Register New User
Creates a new user account with phone number and password authentication.
### Business Rules:
- Phone number must be unique
- Password must meet security requirements (min 8 characters)
...very long description...
    `,
  })
  @ApiBody({ 
    type: RegisterDto,
    description: 'User registration data with device information',
    examples: {
      'Mobile User': {
        // ... very long example ...
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered and authenticated',
    type: AuthResponseDto,
    example: {
      // ... very long example ...
    }
  })
  // ... 5 more ApiResponse decorators ...
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    // Actual business logic gets lost
    return this.authService.register(registerDto);
  }
}
```

**Vấn đề:**
- Controller quá dài và khó đọc
- Business logic bị che lấp bởi documentation
- Khó maintain và update documentation
- Duplicate code giữa các endpoints
- Không tuân thủ Single Responsibility Principle

## Giải pháp: Tách Documentation ra riêng

### 1. Tạo Documentation File

`src/modules/auth/documentation/auth.swagger.ts`:

```typescript
import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';

// Common error responses (DRY principle)
const commonErrorResponses = {
  badRequest: {
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation errors in request data',
    type: ApiErrorResponseDto,
    // ... common example
  },
  unauthorized: {
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - invalid credentials or token',
    type: ApiErrorResponseDto,
    // ... common example
  }
};

/**
 * Register endpoint documentation
 */
export function RegisterApiDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Register new user account',
      description: `Complete description here...`,
    }),
    ApiBody({ 
      type: RegisterDto,
      description: 'User registration data',
      examples: {
        // ... detailed examples
      }
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'User successfully registered',
      type: AuthResponseDto,
      example: {
        // ... detailed example
      }
    }),
    ApiResponse(commonErrorResponses.badRequest),
    ApiResponse(commonErrorResponses.unauthorized)
  );
}

// ... other endpoint documentations
```

### 2. Clean Controller

`src/modules/auth/controllers/auth.controller.ts`:

```typescript
import { RegisterApiDocs, LoginApiDocs } from '../documentation/auth.swagger';

@Controller('auth')
export class AuthController {
  
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RegisterApiDocs() // ✨ Clean và dễ đọc!
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    this.logger.log(\`Registration attempt for phone: \${registerDto.phoneNumber}\`);
    
    const result = await this.authService.register(registerDto);
    
    this.logger.log(\`User registered successfully: \${registerDto.phoneNumber}\`);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @LoginApiDocs() // ✨ Rất clean!
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    // Focus on business logic
    return this.authService.login(loginDto);
  }
}
```

## Lợi ích của Pattern này

### 1. **Separation of Concerns**
- Controller chỉ chứa business logic
- Documentation được tách riêng và có thể reuse
- Tuân thủ Clean Architecture principles

### 2. **Code Readability**
- Controller ngắn gọn, dễ đọc
- Business logic rõ ràng, không bị che lấp
- Method signatures clean và professional

### 3. **Maintainability**
- Documentation dễ update và maintain
- Common responses có thể reuse
- Thay đổi documentation không ảnh hưởng business logic

### 4. **Scalability**
- Dễ thêm new endpoints với documentation
- Pattern có thể apply cho tất cả controllers
- Team có thể work parallel trên documentation và logic

### 5. **Professional Standards**
- Tuân thủ instruction-senior.md guidelines
- Enterprise-level code organization
- Easy to onboard new developers

## Cách Apply cho Controller khác

### Step 1: Tạo Documentation File
```typescript
// src/modules/users/documentation/users.swagger.ts
export function GetUserProfileApiDocs() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get user profile',
      description: 'Retrieve authenticated user profile information'
    }),
    // ... other decorators
  );
}
```

### Step 2: Refactor Controller
```typescript
// src/modules/users/controllers/users.controller.ts
import { GetUserProfileApiDocs } from '../documentation/users.swagger';

@Controller('users')
export class UsersController {
  
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @GetUserProfileApiDocs()
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.userId);
  }
}
```

## Best Practices

1. **Naming Convention**: 
   - Functions: `[Action][Resource]ApiDocs()` (e.g., `GetUserProfileApiDocs`)
   - Files: `[module].swagger.ts`

2. **Common Responses**: 
   - Tạo shared error responses để avoid duplication
   - Group related responses together

3. **Documentation Quality**:
   - Comprehensive descriptions với business rules
   - Real-world examples với proper data
   - Error codes và messages

4. **File Organization**:
   ```
   src/modules/auth/
   ├── controllers/
   │   ├── auth.controller.ts          # Clean business logic
   │   └── device.controller.ts        # Clean business logic
   ├── documentation/
   │   ├── auth.swagger.ts             # Auth documentation
   │   └── device.swagger.ts           # Device documentation
   ├── services/
   └── dto/
   ```

Với pattern này, code trở nên professional, maintainable và tuân thủ enterprise standards!
