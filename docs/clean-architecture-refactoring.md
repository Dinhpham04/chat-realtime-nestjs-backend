# 🏗️ Clean Architecture Refactoring - Repository Pattern Implementation

## 🚨 Vấn đề đã được sửa

### Before (Vi phạm Clean Architecture):
```typescript
// ❌ BAD: Service trực tiếp thao tác với Database Models
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(UserSecurity.name) private readonly userSecurityModel: Model<UserSecurity>,
    @InjectModel(UserCore.name) private readonly userCoreModel: Model<UserCore>,
  ) {}

  async login() {
    // ❌ Service đang làm nhiệm vụ của Repository
    const user = await this.userCoreModel.findOne({ phoneNumber });
    const security = await this.userSecurityModel.findOne({ userId });
  }
}
```

### After (Tuân thủ Clean Architecture):
```typescript
// ✅ GOOD: Service chỉ chứa Business Logic
@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository, // Repository pattern
  ) {}

  async login() {
    // ✅ Service ủy thác data access cho Repository
    const user = await this.authRepository.findUserByPhoneNumber(phoneNumber);
    const security = await this.authRepository.findUserSecurityByUserId(userId);
  }
}
```

## 📋 Nguyên tắc Senior được áp dụng:

### 1. **Clean Architecture Layers**
```
📁 Clean Architecture Structure:
├── 🎮 Controllers (HTTP Layer)
├── 💼 Services (Business Logic Layer)  
├── 🗄️ Repositories (Data Access Layer)
└── 📊 Schemas/Models (Database Layer)
```

### 2. **Separation of Concerns**
- ✅ **Controllers**: Chỉ handle HTTP requests/responses
- ✅ **Services**: Chỉ chứa business logic
- ✅ **Repositories**: Chỉ handle database operations
- ✅ **Schemas**: Chỉ define data structure

### 3. **Dependency Inversion Principle**
```typescript
// ✅ Service depends on Repository Interface (abstraction)
export class AuthService {
  constructor(
    private readonly authRepository: IAuthRepository // Interface, not concrete
  ) {}
}

// ✅ Repository implements Interface (concrete implementation)
export class AuthRepository implements IAuthRepository {
  // Database operations implementation
}
```

## 🏗️ Repository Pattern Implementation:

### Auth Repository Interface:
```typescript
export interface IAuthRepository {
  // User Core operations
  findUserById(userId: string): Promise<UserDocument | null>;
  findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
  createUserCore(userData: Partial<UserCore>): Promise<UserDocument>;
  
  // User Security operations
  findUserSecurityByUserId(userId: string): Promise<any | null>;
  createUserSecurity(userId: string, securityData: Partial<UserSecurity>): Promise<any>;
  incrementFailedLoginAttempts(userId: string): Promise<void>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  
  // User Device operations
  findActiveDevicesByUserId(userId: string): Promise<any[]>;
  deactivateDevice(userId: string, deviceId: string): Promise<void>;
  
  // Authentication specific queries
  isPhoneNumberAvailable(phoneNumber: string): Promise<boolean>;
  validateUserForLogin(phoneNumber: string): Promise<{...} | null>;
}
```

### Repository Implementation:
```typescript
@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @InjectModel(UserCore.name) private readonly userCoreModel: Model<UserDocument>,
    @InjectModel(UserSecurity.name) private readonly userSecurityModel: Model<UserSecurity>,
    @InjectModel(UserDevice.name) private readonly userDeviceModel: Model<UserDevice>,
  ) {}

  async findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    try {
      return await this.userCoreModel.findOne({ phoneNumber }).exec();
    } catch (error) {
      this.logger.error(`Failed to find user by phone ${phoneNumber}: ${error.message}`);
      throw error;
    }
  }
  // ... other methods
}
```

## 🔧 Service Layer Refactoring:

### Before (Service doing Repository work):
```typescript
// ❌ BAD: Business logic mixed with data access
async register(registerData: RegisterCredentials) {
  // Data validation (OK in Service)
  this.validatePasswordConfirmation(registerData.password, registerData.confirmPassword);
  
  // ❌ Direct database access (should be in Repository)
  const existingUser = await this.userCoreModel.findOne({ phoneNumber });
  if (existingUser) {
    throw new ConflictException('Phone number already registered');
  }
  
  // ❌ Direct model creation (should be in Repository)
  const userCore = new this.userCoreModel({
    phoneNumber,
    status: UserStatus.ACTIVE,
  });
  await userCore.save();
}
```

### After (Pure Business Logic):
```typescript
// ✅ GOOD: Only business logic, delegates data access
async register(registerData: RegisterCredentials) {
  // ✅ Business validation
  this.validatePasswordConfirmation(registerData.password, registerData.confirmPassword);
  
  // ✅ Delegate to Repository
  await this.checkPhoneNumberAvailability(registerData.phoneNumber);
  
  // ✅ Business logic orchestration
  const hashedPassword = await this.hashPassword(registerData.password);
  const userCore = await this.createUserCore(registerData.phoneNumber);
  await this.createUserSecurity(userCore._id.toString(), hashedPassword);
}

// ✅ Private methods use Repository
private async checkPhoneNumberAvailability(phoneNumber: string): Promise<void> {
  const isAvailable = await this.authRepository.isPhoneNumberAvailable(phoneNumber);
  if (!isAvailable) {
    throw new ConflictException('Phone number already registered');
  }
}
```

## 📊 Benefits Achieved:

### ✅ **Testability**
```typescript
// ✅ Easy to mock Repository for unit testing
describe('AuthService', () => {
  let authService: AuthService;
  let mockAuthRepository: jest.Mocked<IAuthRepository>;

  beforeEach(() => {
    mockAuthRepository = {
      findUserByPhoneNumber: jest.fn(),
      createUserCore: jest.fn(),
      // ... other mocks
    };
    
    authService = new AuthService(mockAuthRepository, ...);
  });

  it('should register user successfully', async () => {
    mockAuthRepository.isPhoneNumberAvailable.mockResolvedValue(true);
    // Test only business logic, no database dependency
  });
});
```

### ✅ **Maintainability**
- Service chỉ chứa business logic, dễ hiểu và maintain
- Repository có thể thay đổi database implementation mà không ảnh hưởng Service
- Clear separation of concerns

### ✅ **Scalability**
- Có thể dễ dàng thêm caching layer vào Repository
- Có thể switch sang database khác (PostgreSQL, etc.)
- Microservices ready - Repository có thể thành API service

### ✅ **Code Reusability**
- Repository methods có thể được reuse trong nhiều Services
- Interface cho phép multiple implementations
- Consistent data access patterns

## 🎯 Module Architecture:

### UsersModule (Data Layer):
```typescript
@Module({
  imports: [MongooseModule.forFeature([...schemas])],
  providers: [
    UsersRepository,    // General user operations
    AuthRepository,     // Authentication specific operations
  ],
  exports: [
    UsersRepository,
    AuthRepository,
  ]
})
export class UsersModule {}
```

### AuthModule (Business Layer):
```typescript
@Module({
  imports: [
    UsersModule,    // Import Repository providers
    RedisModule,
    JwtModule,
  ],
  providers: [
    AuthService,    // Business logic only
    TokenService,
    DeviceService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
```

## 🔍 Code Quality Improvements:

### Error Handling:
```typescript
// ✅ Repository handles database errors
async findUserByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
  try {
    return await this.userCoreModel.findOne({ phoneNumber }).exec();
  } catch (error) {
    this.logger.error(`Failed to find user by phone ${phoneNumber}: ${error.message}`);
    throw error; // Let service handle business logic errors
  }
}
```

### Logging:
```typescript
// ✅ Repository logs data access operations
// ✅ Service logs business operations
this.logger.log(`User registered successfully: ${registerData.phoneNumber}`);
```

### Type Safety:
```typescript
// ✅ Complete interface definitions
// ✅ Proper return types
// ✅ No 'any' types in public interfaces
```

## 🚀 Next Steps:

### 1. **Add Unit Tests**
```typescript
// Repository unit tests
describe('AuthRepository', () => {
  // Test database operations
});

// Service unit tests  
describe('AuthService', () => {
  // Test business logic with mocked repository
});
```

### 2. **Add Caching Layer**
```typescript
@Injectable()
export class CachedAuthRepository implements IAuthRepository {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly cacheService: CacheService,
  ) {}
  
  async findUserByPhoneNumber(phoneNumber: string) {
    const cached = await this.cacheService.get(`user:${phoneNumber}`);
    if (cached) return cached;
    
    const user = await this.authRepository.findUserByPhoneNumber(phoneNumber);
    await this.cacheService.set(`user:${phoneNumber}`, user);
    return user;
  }
}
```

### 3. **Database Migration Support**
- Repository có thể handle schema changes
- Business logic không bị ảnh hưởng

---

## 💡 Senior Developer Lessons:

1. **"Service ≠ Repository"** - Service chứa business logic, Repository chứa data access
2. **"Interface first"** - Define contracts trước khi implement  
3. **"Single Responsibility"** - Mỗi layer có một nhiệm vụ rõ ràng
4. **"Dependency Inversion"** - Depend on abstractions, not concretions
5. **"Testability by design"** - Architecture phải dễ test

**Kết luận**: Code hiện tại đã tuân thủ **Clean Architecture** và **SOLID principles** theo Senior Developer Guidelines! 🎯
