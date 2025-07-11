# 6. Authentication & Authorization (JWT, Guard, Session)

## Tổng quan về Authentication vs Authorization

### Authentication (Xác thực)
- **Là gì**: Xác minh danh tính của user ("Bạn là ai?")
- **Mục đích**: Đảm bảo user thực sự là người họ claim to be
- **Phương thức**: Username/password, JWT token, OAuth, biometric, etc.

### Authorization (Ủy quyền)
- **Là gì**: Xác định quyền truy cập của user ("Bạn có quyền làm gì?")
- **Mục đích**: Kiểm soát user có thể truy cập resource nào
- **Phương thức**: Role-based (RBAC), Permission-based, ACL, etc.

### Flow Authentication & Authorization
```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Login     │──►│ Validate    │──►│ Generate    │──►│ Store Token │
│ Credentials │   │ User        │   │ JWT Token   │   │ /Session    │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
                                                              │
┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│ Access      │◄──│ Check       │◄──│ Verify      │◄─────────┘
│ Resource    │   │ Permission  │   │ Token       │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## 1. JWT (JSON Web Token) Authentication

### Cài đặt packages
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcrypt
npm install -D @types/passport-jwt @types/passport-local @types/bcrypt
```

### JWT Token Structure
```
Header.Payload.Signature

# Header (Base64 encoded)
{
  "alg": "HS256",  // Algorithm
  "typ": "JWT"     // Type
}

# Payload (Base64 encoded)
{
  "sub": "user-id",      // Subject (user identifier)
  "username": "john",    // Username
  "role": "admin",       // User role
  "iat": 1641234567,     // Issued at (timestamp)
  "exp": 1641320967      // Expiration time
}

# Signature (HMAC SHA256)
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### JWT Configuration
```typescript
// auth/jwt.config.ts
import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1d'), // 1 day
    issuer: configService.get<string>('JWT_ISSUER', 'chat-app'),
    audience: configService.get<string>('JWT_AUDIENCE', 'chat-users'),
  },
  verifyOptions: {
    ignoreExpiration: false,
    ignoreNotBefore: false,
  },
});
```

### Auth Module Setup
```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../schemas/user.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshToken, RefreshTokenSchema } from '../schemas/refresh-token.schema';
import { jwtConfig } from './jwt.config';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    
    // JWT Module với async config
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: jwtConfig,
      inject: [ConfigService],
    }),
    
    // Mongoose schemas
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    
    UsersModule, // Import để sử dụng UsersService
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

### Refresh Token Schema
```typescript
// schemas/refresh-token.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true })
export class RefreshToken {
  _id: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true 
  })
  userId: Types.ObjectId;

  @Prop({ 
    required: true,
    unique: true 
  })
  token: string;

  @Prop({ 
    required: true 
  })
  expiresAt: Date;

  @Prop({ 
    default: false 
  })
  isRevoked: boolean;

  @Prop({
    type: String,
    required: false
  })
  deviceInfo?: string; // User agent, IP, device name

  @Prop({
    type: String,
    required: false
  })
  ipAddress?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Index để tự động xóa expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ userId: 1 });
RefreshTokenSchema.index({ token: 1 });
```

### Auth Service
```typescript
// auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { User, UserDocument } from '../schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;      // User ID
  username: string;
  email: string;
  role: string;
  iat?: number;     // Issued at
  exp?: number;     // Expires at
}

export interface AuthResult {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshTokenDocument>,
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  // Đăng ký user mới
  async register(registerDto: RegisterDto, deviceInfo?: string, ipAddress?: string): Promise<AuthResult> {
    const { username, email, password, firstName, lastName } = registerDto;

    // Kiểm tra user đã tồn tại
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }]
    }).exec();

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already exists');
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = new this.userModel({
      username,
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'user', // Default role
      isActive: true,
      emailVerified: false, // Cần verify email
    });

    const savedUser = await newUser.save();

    // Generate tokens
    const tokens = await this.generateTokens(savedUser, deviceInfo, ipAddress);

    // Trả về thông tin user (không có password)
    const { password: _, ...userWithoutPassword } = savedUser.toObject();

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  // Đăng nhập
  async login(loginDto: LoginDto, deviceInfo?: string, ipAddress?: string): Promise<AuthResult> {
    const { email, password, rememberMe } = loginDto;

    // Tìm user theo email (bao gồm password để verify)
    const user = await this.userModel
      .findOne({ email })
      .select('+password') // Explicitly include password
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Kiểm tra user có active không
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.userModel.findByIdAndUpdate(user._id, {
      lastSeen: new Date(),
      lastLoginAt: new Date(),
    }).exec();

    // Generate tokens với custom expiry nếu remember me
    const tokens = await this.generateTokens(user, deviceInfo, ipAddress, rememberMe);

    // Trả về user info (không có password)
    const { password: _, ...userWithoutPassword } = user.toObject();

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  // Validate user cho Passport Local Strategy
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userModel
      .findOne({ email, isActive: true })
      .select('+password')
      .exec();

    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  // Validate JWT token cho JWT Strategy
  async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
    const user = await this.userModel
      .findById(payload.sub)
      .select('-password')
      .exec();

    if (!user || !user.isActive) {
      return null;
    }

    return user.toObject();
  }

  // Generate access token và refresh token
  private async generateTokens(
    user: UserDocument, 
    deviceInfo?: string, 
    ipAddress?: string,
    rememberMe?: boolean
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    
    const payload: JwtPayload = {
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    // Generate access token
    const accessTokenExpiry = rememberMe ? '7d' : '1d';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });

    // Generate refresh token
    const refreshTokenValue = uuidv4();
    const refreshTokenExpiry = rememberMe ? 30 : 7; // days

    const refreshToken = new this.refreshTokenModel({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + refreshTokenExpiry * 24 * 60 * 60 * 1000),
      deviceInfo,
      ipAddress,
    });

    await refreshToken.save();

    // Cleanup old refresh tokens for this user (keep only 5 most recent)
    await this.cleanupOldRefreshTokens(user._id);

    const expiresIn = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // seconds

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn,
    };
  }

  // Refresh access token
  async refreshToken(refreshTokenValue: string): Promise<{ accessToken: string; expiresIn: number }> {
    const refreshToken = await this.refreshTokenModel
      .findOne({ 
        token: refreshTokenValue, 
        isRevoked: false,
        expiresAt: { $gt: new Date() } // Chưa expire
      })
      .populate('userId')
      .exec();

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = refreshToken.userId as UserDocument;

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Generate new access token
    const payload: JwtPayload = {
      sub: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1d',
    });

    return {
      accessToken,
      expiresIn: 24 * 60 * 60, // 1 day in seconds
    };
  }

  // Logout (revoke refresh token)
  async logout(refreshTokenValue: string): Promise<void> {
    await this.refreshTokenModel
      .findOneAndUpdate(
        { token: refreshTokenValue },
        { isRevoked: true }
      )
      .exec();
  }

  // Logout từ tất cả devices
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany(
        { userId, isRevoked: false },
        { isRevoked: true }
      )
      .exec();
  }

  // Get active sessions của user
  async getActiveSessions(userId: string) {
    return this.refreshTokenModel
      .find({
        userId,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      })
      .select('deviceInfo ipAddress createdAt')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Cleanup old refresh tokens (giữ lại 5 tokens mới nhất)
  private async cleanupOldRefreshTokens(userId: any): Promise<void> {
    const tokens = await this.refreshTokenModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(5) // Giữ lại 5 tokens mới nhất
      .select('_id')
      .exec();

    if (tokens.length > 0) {
      const tokenIds = tokens.map(token => token._id);
      await this.refreshTokenModel.deleteMany({ _id: { $in: tokenIds } }).exec();
    }
  }

  // Change password
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      passwordChangedAt: new Date(),
    }).exec();

    // Revoke all refresh tokens (force re-login)
    await this.logoutAll(userId);
  }

  // Forgot password - generate reset token
  async forgotPassword(email: string): Promise<string> {
    const user = await this.userModel.findOne({ email, isActive: true }).exec();
    
    if (!user) {
      // Không throw error để tránh user enumeration attack
      return 'If email exists, reset instructions have been sent';
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.userModel.findByIdAndUpdate(user._id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetTokenExpiry,
    }).exec();

    // TODO: Send email với reset link
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return 'Password reset instructions have been sent to your email';
  }

  // Reset password với token
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    const user = await this.userModel.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: new Date() }, // Token chưa expire
      isActive: true,
    }).exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password và clear reset token
    await this.userModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    }).exec();

    // Revoke all refresh tokens
    await this.logoutAll(user._id.toString());
  }
}
```

### Local Strategy (Username/Password)
```typescript
// auth/strategies/local.strategy.ts
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // Sử dụng email thay vì username
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
```

### JWT Strategy
```typescript
// auth/strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Lấy từ Authorization header
      ignoreExpiration: false, // Không ignore expiration
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER'),
      audience: configService.get<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: JwtPayload) {
    // Payload đã được verify bởi passport-jwt
    const user = await this.authService.validateJwtPayload(payload);
    
    if (!user) {
      throw new UnauthorizedException('Token is invalid or user not found');
    }
    
    return user; // Sẽ được gán vào request.user
  }
}
```

---

## 2. Guards - Bảo vệ Routes

### JWT Auth Guard
```typescript
// auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Kiểm tra route có được đánh dấu @Public() không
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true; // Cho phép truy cập public routes
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Access token is required');
    }
    return user;
  }
}
```

### Local Auth Guard
```typescript
// auth/guards/local-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

### Roles Guard
```typescript
// auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true; // Không có yêu cầu role cụ thể
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
```

### Resource Owner Guard
```typescript
// auth/guards/resource-owner.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }

    // Admin có thể truy cập mọi resource
    if (user.role === 'admin') {
      return true;
    }

    // Kiểm tra resource ownership
    const resourceUserId = request.params.userId || request.params.id;
    
    if (resourceUserId && resourceUserId !== user.id) {
      throw new ForbiddenException('You can only access your own resources');
    }

    return true;
  }
}
```

---

## 3. Decorators

### Public Decorator
```typescript
// auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Roles Decorator
```typescript
// auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### User Decorator
```typescript
// auth/decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Usage examples:
// @User() user: User - Lấy toàn bộ user object
// @User('id') userId: string - Lấy chỉ user ID
// @User('role') userRole: string - Lấy chỉ user role
```

---

## 4. DTOs cho Authentication

### Register DTO
```typescript
// auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ 
    description: 'Username', 
    example: 'john_doe',
    minLength: 3,
    maxLength: 20
  })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username: string;

  @ApiProperty({ 
    description: 'Email address', 
    example: 'john@example.com' 
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ 
    description: 'Password', 
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character' }
  )
  password: string;

  @ApiProperty({ 
    description: 'First name', 
    example: 'John',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiProperty({ 
    description: 'Last name', 
    example: 'Doe',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;
}
```

### Login DTO
```typescript
// auth/dto/login.dto.ts
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'Email address', 
    example: 'john@example.com' 
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Password', 
    example: 'SecurePassword123!' 
  })
  @IsString()
  password: string;

  @ApiProperty({ 
    description: 'Remember me for longer session', 
    example: false,
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}
```

### Change Password DTO
```typescript
// auth/dto/change-password.dto.ts
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ 
    description: 'Current password' 
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({ 
    description: 'New password',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character' }
  )
  newPassword: string;
}
```

---

## 5. Auth Controller
```typescript
// auth/auth.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Req, 
  HttpCode, 
  HttpStatus,
  Headers,
  Ip
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { User } from './decorators/user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(
    @Body() registerDto: RegisterDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    return this.authService.register(registerDto, userAgent, ipAddress);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @User() user: any,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    // LocalAuthGuard đã validate user qua LocalStrategy
    return this.authService.login(loginDto, userAgent, ipAddress);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
    return { message: 'Successfully logged out' };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@User('id') userId: string) {
    await this.authService.logoutAll(userId);
    return { message: 'Successfully logged out from all devices' };
  }

  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@User() user: any) {
    return { user };
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  async getActiveSessions(@User('id') userId: string) {
    const sessions = await this.authService.getActiveSessions(userId);
    return { sessions };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @User('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    return { message: 'Password successfully changed' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body('email') email: string) {
    const message = await this.authService.forgotPassword(email);
    return { message };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    await this.authService.resetPassword(token, newPassword);
    return { message: 'Password successfully reset' };
  }
}
```

---

## 6. Global Guards Setup

### App Module với Global Guards
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    // ... other modules
  ],
  providers: [
    // Global Guards - áp dụng cho tất cả routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Mọi route đều cần authentication trừ khi có @Public()
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Kiểm tra roles nếu có @Roles()
    },
  ],
})
export class AppModule {}
```

---

## 7. Usage Examples trong Controllers

### Protected Routes với Different Guards
```typescript
// users/users.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { ResourceOwnerGuard } from '../auth/guards/resource-owner.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Chỉ admin mới có thể truy cập
  @Roles('admin')
  @Get()
  async getAllUsers() {
    return this.usersService.findAll();
  }

  // User chỉ có thể xem profile của chính mình, admin có thể xem tất cả
  @UseGuards(ResourceOwnerGuard)
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // Lấy thông tin user hiện tại
  @Get('me')
  async getCurrentUser(@User() user: any) {
    return user;
  }

  // Chỉ admin hoặc moderator
  @Roles('admin', 'moderator')
  @Get('reports/statistics')
  async getUserStatistics() {
    return this.usersService.getStatistics();
  }
}
```

### Chat Messages với Authorization
```typescript
// messages/messages.controller.ts
import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { User } from '../auth/decorators/user.decorator';
import { ResourceOwnerGuard } from '../auth/guards/resource-owner.guard';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  // Kiểm tra user có thuộc conversation không
  @UseGuards(ConversationMemberGuard)
  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @User('id') userId: string,
  ) {
    return this.messagesService.getMessages(conversationId, userId);
  }

  @UseGuards(ConversationMemberGuard)
  @Post()
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @User('id') userId: string,
    @Body() messageDto: CreateMessageDto,
  ) {
    return this.messagesService.sendMessage(conversationId, userId, messageDto);
  }
}
```

### Custom Guard cho Conversation Membership
```typescript
// guards/conversation-member.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class ConversationMemberGuard implements CanActivate {
  constructor(private conversationsService: ConversationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const conversationId = request.params.conversationId;

    if (!user || !conversationId) {
      return false;
    }

    // Kiểm tra user có phải member của conversation không
    const isMember = await this.conversationsService.isUserMember(conversationId, user.id);
    
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return true;
  }
}
```

---

## 8. Session-based Authentication (Alternative)

### Session Module
```typescript
// session/session.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { SessionSerializer } from './session.serializer';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule.register({ 
      defaultStrategy: 'local',
      session: true, // Enable session support
    }),
  ],
  providers: [LocalStrategy, SessionSerializer],
  exports: [PassportModule],
})
export class SessionModule {}
```

### Session Serializer
```typescript
// session/session.serializer.ts
import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { UsersService } from '../users/users.service';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private usersService: UsersService) {
    super();
  }

  serializeUser(user: any, done: (err: Error, user: any) => void): any {
    // Lưu user ID vào session
    done(null, { id: user.id });
  }

  async deserializeUser(payload: any, done: (err: Error, user: any) => void): Promise<any> {
    // Lấy user từ database dựa trên ID trong session
    const user = await this.usersService.findOne(payload.id);
    done(null, user);
  }
}
```

### Session Guard
```typescript
// session/guards/session-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.isAuthenticated(); // Passport method
  }
}
```

---

## 9. Environment Configuration

### .env file
```bash
# JWT
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=chat-app
JWT_AUDIENCE=chat-users

# Session (if using session-based auth)
SESSION_SECRET=your-session-secret-key
SESSION_MAX_AGE=86400000

# Security
BCRYPT_SALT_ROUNDS=12
PASSWORD_RESET_TOKEN_EXPIRES=900000

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## 10. Best Practices & Security

### 1. Password Security
```typescript
// Strong password policy
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Bcrypt với salt rounds cao
const saltRounds = 12; // Tốn thời gian nhưng bảo mật hơn

// Password history (không cho đổi thành password cũ)
@Schema()
export class PasswordHistory {
  @Prop({ required: true })
  userId: string;
  
  @Prop({ required: true })
  passwordHash: string;
  
  @Prop({ default: Date.now })
  createdAt: Date;
}
```

### 2. JWT Security
```typescript
// JWT Configuration với security headers
{
  secret: process.env.JWT_SECRET, // Dài ít nhất 256 bits
  signOptions: {
    expiresIn: '15m', // Access token ngắn hạn
    issuer: 'your-app-name',
    audience: 'your-users',
    algorithm: 'HS256', // Hoặc RS256 với public/private keys
  },
}

// Blacklist tokens khi logout
const tokenBlacklist = new Set();

// Middleware kiểm tra blacklisted tokens
@Injectable()
export class JwtBlacklistMiddleware {
  use(req: any, res: any, next: () => void) {
    const token = this.extractTokenFromHeader(req);
    if (token && tokenBlacklist.has(token)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    next();
  }
}
```

### 3. Rate Limiting
```typescript
// Rate limiting cho login
npm install @nestjs/throttler

// throttler.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 60 seconds
      limit: 5, // 5 requests per 60 seconds
    }),
  ],
})

// Trong auth controller
@UseGuards(ThrottlerGuard)
@Post('login')
async login(@Body() loginDto: LoginDto) {
  // Login logic
}
```

### 4. Account Lockout
```typescript
// User schema với lockout fields
@Schema()
export class User {
  // ...existing fields
  
  @Prop({ default: 0 })
  loginAttempts: number;
  
  @Prop()
  lockUntil?: Date;
  
  @Prop({ default: false })
  isLocked: boolean;
}

// Auth service với lockout logic
async validateUser(email: string, password: string) {
  const user = await this.userModel.findOne({ email }).exec();
  
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }
  
  // Kiểm tra account lock
  if (user.isLocked && user.lockUntil && user.lockUntil > new Date()) {
    throw new UnauthorizedException('Account is temporarily locked');
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    // Tăng failed attempts
    await this.handleFailedLogin(user);
    throw new UnauthorizedException('Invalid credentials');
  }
  
  // Reset failed attempts khi login thành công
  if (user.loginAttempts > 0) {
    await this.userModel.findByIdAndUpdate(user._id, {
      $unset: { loginAttempts: 1, lockUntil: 1 },
      isLocked: false,
    });
  }
  
  return user;
}

private async handleFailedLogin(user: UserDocument) {
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes
  
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  if (user.loginAttempts + 1 >= maxAttempts) {
    updates.lockUntil = new Date(Date.now() + lockTime);
    updates.isLocked = true;
  }
  
  await this.userModel.findByIdAndUpdate(user._id, updates);
}
```

### 5. Two-Factor Authentication (2FA)
```typescript
// 2FA Schema
@Schema()
export class TwoFactorAuth {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;
  
  @Prop({ required: true })
  secret: string;
  
  @Prop({ default: false })
  isEnabled: boolean;
  
  @Prop()
  backupCodes: string[];
}

// 2FA Service
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorAuthService {
  generateSecret(userEmail: string) {
    return speakeasy.generateSecret({
      name: `ChatApp (${userEmail})`,
      issuer: 'ChatApp',
    });
  }
  
  async generateQRCode(secret: string): Promise<string> {
    return QRCode.toDataURL(secret);
  }
  
  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 steps tolerance
    });
  }
}
```

---

**Kết luận**: Authentication & Authorization là foundation của mọi ứng dụng. JWT phù hợp cho stateless apps, session-based tốt cho traditional web apps. Guards và Decorators giúp implement authorization linh hoạt. Security practices như rate limiting, account lockout, 2FA là essential cho production apps.

---
**Tiếp theo: WebSocket & Real-time Communication**
