# Social Authentication Implementation Plan - Phase 2

## 📋 **Phân tích Module Auth hiện tại**

### ✅ **Components đã có sẵn:**
- **Core Authentication Flow**: Phone + Password đã hoàn thiện
- **JWT Token System**: Access + Refresh tokens với device binding
- **Device Management**: 5-device limit enforcement
- **Security Layer**: Rate limiting, password hashing, audit logging
- **Repository Pattern**: Interface-based repositories cho extensibility
- **Guard System**: JWT authentication và rate limiting guards
- **DTO Validation**: Comprehensive input validation
- **Swagger Documentation**: Complete API documentation

### 🔧 **Architecture hiện tại hỗ trợ mở rộng:**
```typescript
// Interface-based repository pattern
interface IAuthRepository {
  findByPhone(phoneNumber: string): Promise<UserSecurity | null>;
  findByEmail(email: string): Promise<UserSecurity | null>; // Ready for social
  createUser(userData: CreateUserData): Promise<UserSecurity>;
}

// Modular service structure
- AuthService: Core authentication logic
- TokenService: JWT management
- DeviceService: Device management
- SocialAuthService: Chờ implement
```

### 📱 **DTO Structure sẵn sàng:**
- `SocialLoginDto`: Đã có cấu trúc cơ bản cho Google
- `DeviceInfoDto`: Compatible với social login flow
- `AuthResponse`: Unified response structure

---

## 🎯 **Social Authentication Strategy**

### **Phase 2A: Google OAuth Integration (Week 1-2)**
### **Phase 2B: Facebook Login Integration (Week 3)**  
### **Phase 2C: GitHub OAuth Integration (Week 4)**
### **Phase 2D: Account Linking & Management (Week 5)**

---

## 🏗️ **Detailed Implementation Plan**

### **Phase 2A: Google OAuth Integration**

#### **1. Dependencies & Configuration**
```bash
# Install required packages
npm install @nestjs/passport passport-google-oauth20
npm install --save-dev @types/passport-google-oauth20
```

#### **2. Environment Configuration**
```typescript
// .env additions
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Mobile app configurations
GOOGLE_IOS_CLIENT_ID=your-ios-client-id
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
```

#### **3. Schema Extensions**
```typescript
// Extend UserSecurity schema
interface SocialProvider {
  provider: 'google' | 'facebook' | 'github';
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string; // Encrypted
  refreshToken?: string; // Encrypted
  tokenExpiresAt?: Date;
  linkedAt: Date;
  isVerified: boolean;
}

// Add to UserSecurity
socialProviders: SocialProvider[];
primaryEmail?: string; // For social account linking
```

#### **4. New Services Implementation**

##### **A. Social Auth Service**
```typescript
// src/modules/auth/services/social-auth.service.ts
@Injectable()
export class SocialAuthService {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly deviceService: DeviceService,
    private readonly userService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  // Google OAuth Web Flow
  async googleLogin(accessToken: string, deviceInfo: DeviceInfo): Promise<AuthResponse>
  
  // Google OAuth Mobile Flow  
  async googleMobileLogin(idToken: string, deviceInfo: DeviceInfo): Promise<AuthResponse>
  
  // Account linking
  async linkGoogleAccount(userId: string, googleData: GoogleUserData): Promise<void>
  
  // Account unlinking
  async unlinkSocialAccount(userId: string, provider: string): Promise<void>
  
  // Get user social providers
  async getUserSocialProviders(userId: string): Promise<SocialProvider[]>
}
```

##### **B. Google OAuth Service**
```typescript
// src/modules/auth/services/google-oauth.service.ts
@Injectable()
export class GoogleOAuthService {
  // Verify Google ID token (mobile)
  async verifyGoogleIdToken(idToken: string): Promise<GoogleUserData>
  
  // Get user info from Google access token (web)
  async getGoogleUserInfo(accessToken: string): Promise<GoogleUserData>
  
  // Refresh Google access token
  async refreshGoogleToken(refreshToken: string): Promise<GoogleTokens>
}
```

#### **5. New Strategies**
```typescript
// src/modules/auth/strategies/google.strategy.ts
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      providerId: profile.id,
      email: profile.emails[0].value,
      displayName: profile.displayName,
      avatarUrl: profile.photos[0].value,
      accessToken,
      refreshToken,
    };
  }
}
```

#### **6. New Controllers**
```typescript
// src/modules/auth/controllers/social-auth.controller.ts
@ApiTags('Social Authentication')
@Controller('auth')
export class SocialAuthController {
  
  // Web OAuth flow
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Request() req, @Response() res) {
    // Handle OAuth callback
  }

  // Mobile OAuth flow
  @Post('google/mobile')
  async googleMobileLogin(@Body() dto: GoogleMobileLoginDto): Promise<AuthResponse> {
    // Handle mobile Google sign-in
  }

  // Account linking
  @Post('link/google')
  @UseGuards(JwtAuthGuard)
  async linkGoogleAccount(@Request() req, @Body() dto: LinkGoogleAccountDto) {
    // Link Google account to existing user
  }

  // Get linked accounts
  @Get('linked-accounts')
  @UseGuards(JwtAuthGuard)
  async getLinkedAccounts(@Request() req) {
    // Get user's linked social accounts
  }

  // Unlink account
  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  async unlinkAccount(@Request() req, @Param('provider') provider: string) {
    // Unlink social account
  }
}
```

#### **7. New DTOs**
```typescript
// src/modules/auth/dto/google-login.dto.ts
export class GoogleMobileLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo: DeviceInfoDto;
}

export class LinkGoogleAccountDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsOptional()
  @IsString()
  idToken?: string;
}

export class GoogleCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}
```

#### **8. Database Migrations**
```typescript
// Add social providers to existing UserSecurity documents
db.userSecurity.updateMany(
  {},
  {
    $set: {
      socialProviders: [],
      primaryEmail: null
    }
  }
);

// Create indexes for social auth
db.userSecurity.createIndex({ "socialProviders.providerId": 1, "socialProviders.provider": 1 });
db.userSecurity.createIndex({ "primaryEmail": 1 });
```

---

### **Phase 2B: Facebook Login Integration**

#### **1. Dependencies**
```bash
npm install passport-facebook
npm install --save-dev @types/passport-facebook
```

#### **2. Implementation Structure**
```typescript
// Similar pattern to Google but for Facebook
- FacebookStrategy
- FacebookOAuthService  
- Facebook endpoints in SocialAuthController
- FacebookMobileLoginDto
```

#### **3. Key Differences:**
- Facebook Graph API integration
- Different scope requirements (`email`, `public_profile`)
- Mobile SDK token verification
- Privacy considerations for profile data

---

### **Phase 2C: GitHub OAuth Integration**

#### **1. Dependencies**
```bash
npm install passport-github2
npm install --save-dev @types/passport-github2
```

#### **2. Implementation Focus:**
- Developer-focused authentication
- Repository access scopes (optional)
- GitHub API integration for profile data
- Email verification handling (GitHub emails can be private)

---

### **Phase 2D: Account Linking & Management**

#### **1. Account Linking Logic**
```typescript
// Link accounts by email matching
async linkAccountsByEmail(email: string): Promise<void> {
  // Find existing account with same email
  // Merge social providers
  // Update primary account
  // Invalidate secondary account tokens
}

// Manual account linking
async linkAccountsManual(primaryUserId: string, secondaryUserId: string): Promise<void> {
  // User-initiated account merge
  // Transfer social providers
  // Update device associations
  // Clean up secondary account
}
```

#### **2. Security Considerations**
- Email verification before linking
- Two-factor authentication for account linking
- Audit logging for all linking operations
- User consent and confirmation flows

---

## 📊 **API Endpoints Design**

### **Google Authentication**
```bash
# Web OAuth Flow
GET  /auth/google                     # Initiate Google OAuth
GET  /auth/google/callback           # OAuth callback handler

# Mobile OAuth Flow  
POST /auth/google/mobile             # Mobile Google sign-in
POST /auth/google/verify-token       # Verify Google ID token

# Account Management
POST /auth/link/google              # Link Google account
GET  /auth/linked-accounts          # Get linked accounts
DELETE /auth/unlink/google          # Unlink Google account
```

### **Facebook Authentication**
```bash
GET  /auth/facebook                  # Initiate Facebook OAuth
GET  /auth/facebook/callback         # Facebook callback
POST /auth/facebook/mobile           # Mobile Facebook login
POST /auth/link/facebook            # Link Facebook account
DELETE /auth/unlink/facebook        # Unlink Facebook
```

### **GitHub Authentication**
```bash
GET  /auth/github                    # Initiate GitHub OAuth
GET  /auth/github/callback           # GitHub callback
POST /auth/github/mobile             # GitHub mobile (if supported)
POST /auth/link/github              # Link GitHub account
DELETE /auth/unlink/github          # Unlink GitHub
```

---

## 🔒 **Security Implementation**

### **1. Token Security**
```typescript
// Encrypt social provider tokens
class TokenEncryption {
  encrypt(token: string): string;
  decrypt(encryptedToken: string): string;
}

// Store encrypted tokens in database
socialProviders: [{
  accessToken: encrypt(token),
  refreshToken: encrypt(refreshToken)
}]
```

### **2. Email Verification**
```typescript
// Verify email ownership before account linking
async verifyEmailOwnership(email: string, provider: string): Promise<boolean> {
  // Send verification email
  // User must confirm ownership
  // Time-limited verification tokens
}
```

### **3. Rate Limiting**
```typescript
// Enhanced rate limiting for social auth
@UseGuards(SocialAuthRateLimitGuard)
export class SocialAuthController {
  // 3 attempts per IP per 5 minutes for social login
  // 1 attempt per user per minute for account linking
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
// Social auth service tests
describe('SocialAuthService', () => {
  test('should authenticate with valid Google token');
  test('should link Google account to existing user');
  test('should handle expired tokens gracefully');
  test('should prevent duplicate account linking');
});

// OAuth service tests  
describe('GoogleOAuthService', () => {
  test('should verify valid Google ID token');
  test('should reject invalid tokens');
  test('should refresh expired tokens');
});
```

### **Integration Tests**
```typescript
// End-to-end OAuth flows
describe('Google OAuth Integration', () => {
  test('should complete web OAuth flow');
  test('should handle mobile token verification');
  test('should link accounts with same email');
  test('should prevent unauthorized account linking');
});
```

### **Security Tests**
```typescript
// Security validation tests
describe('Social Auth Security', () => {
  test('should reject forged tokens');
  test('should enforce rate limiting');
  test('should validate email ownership');
  test('should audit all linking operations');
});
```

---

## 📱 **Client Integration Examples**

### **React Native Expo (Google)**
```typescript
import * as Google from 'expo-auth-session/providers/google';

// Configure Google auth
const [request, response, promptAsync] = Google.useAuthRequest({
  iosClientId: 'your-ios-client-id',
  androidClientId: 'your-android-client-id',
});

// Handle sign-in
const handleGoogleSignIn = async () => {
  const result = await promptAsync();
  if (result.type === 'success') {
    // Send ID token to backend
    const authResponse = await fetch('/auth/google/mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: result.params.id_token,
        deviceInfo: getDeviceInfo()
      })
    });
  }
};
```

### **Web React (Google)**
```typescript
import { GoogleLogin } from '@react-oauth/google';

// Google sign-in component
<GoogleLogin
  onSuccess={(credentialResponse) => {
    // Send credential to backend
    fetch('/auth/google/mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: credentialResponse.credential,
        deviceInfo: getDeviceInfo()
      })
    });
  }}
  onError={() => console.log('Login Failed')}
/>
```

---

## 📊 **Implementation Timeline**

### **Week 1: Google OAuth Foundation**
- [ ] Install dependencies and configure environment
- [ ] Implement GoogleOAuthService
- [ ] Create Google strategy and guards
- [ ] Add Google endpoints to controller
- [ ] Unit tests for Google integration

### **Week 2: Google OAuth Polish**
- [ ] Account linking logic
- [ ] Mobile ID token verification
- [ ] Error handling and edge cases
- [ ] Integration tests
- [ ] Documentation updates

### **Week 3: Facebook Integration**
- [ ] Facebook OAuth service
- [ ] Facebook strategy implementation
- [ ] Facebook mobile integration
- [ ] Account linking for Facebook
- [ ] Testing and validation

### **Week 4: GitHub Integration**
- [ ] GitHub OAuth service
- [ ] GitHub strategy and endpoints
- [ ] Developer-specific features
- [ ] Testing and edge cases
- [ ] Documentation completion

### **Week 5: Account Management & Security**
- [ ] Enhanced account linking logic
- [ ] Security hardening
- [ ] Audit logging improvements
- [ ] Performance optimization
- [ ] Final testing and deployment prep

---

## 🚀 **Success Metrics**

### **Technical Metrics**
- [ ] Google OAuth success rate > 95%
- [ ] Account linking completion rate > 90%
- [ ] API response time < 500ms
- [ ] Zero security incidents
- [ ] Test coverage > 80%

### **User Experience Metrics**
- [ ] Social login adoption rate
- [ ] Time to complete authentication
- [ ] User satisfaction with linking process
- [ ] Support ticket reduction

### **Security Metrics**
- [ ] Failed authentication attempts
- [ ] Suspicious account linking attempts
- [ ] Token refresh success rate
- [ ] Audit log completeness

---

## 🔮 **Future Enhancements (Phase 3)**

### **Additional Providers**
- Apple Sign-In (iOS)
- Microsoft/LinkedIn OAuth
- Twitter OAuth 2.0
- Discord OAuth

### **Advanced Features**
- Progressive profile enrichment
- Social contact import
- Cross-platform session sync
- Advanced fraud detection

### **Enterprise Features**
- SSO integration (SAML, OIDC)
- Active Directory integration
- Multi-tenant social auth
- Custom OAuth providers

---

## 📝 **Migration Plan from Phase 1**

### **Backward Compatibility**
- [ ] Existing phone + password auth unchanged
- [ ] Current JWT tokens remain valid
- [ ] Device management works with social auth
- [ ] No breaking changes to existing APIs

### **Database Migration**
```sql
-- Add social provider fields to existing users
ALTER TABLE user_security ADD COLUMN social_providers JSONB DEFAULT '[]';
ALTER TABLE user_security ADD COLUMN primary_email VARCHAR(255);

-- Create indexes
CREATE INDEX idx_user_security_social_provider ON user_security USING GIN (social_providers);
CREATE INDEX idx_user_security_primary_email ON user_security (primary_email);
```

### **Configuration Updates**
```typescript
// Add to environment variables
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

// Update module imports
AuthModule.forRoot({
  enableSocialAuth: true,
  providers: ['google', 'facebook', 'github']
})
```

---

## ✅ **Definition of Done**

### **Phase 2A Complete When:**
- [ ] Google OAuth web flow working
- [ ] Google mobile ID token verification working
- [ ] Account linking functional
- [ ] All tests passing (unit + integration)
- [ ] Documentation updated
- [ ] Security review completed

### **Phase 2B-C Complete When:**
- [ ] Facebook and GitHub OAuth working
- [ ] Cross-provider account linking functional
- [ ] Comprehensive test coverage
- [ ] Performance benchmarks met

### **Phase 2D Complete When:**
- [ ] Account management UI/API complete
- [ ] Security audit passed
- [ ] Load testing successful
- [ ] Production deployment ready
- [ ] Monitoring and alerting configured

---

**Kế hoạch này tận dụng tối đa kiến trúc module auth hiện tại, mở rộng một cách có hệ thống và đảm bảo tương thích ngược hoàn toàn với Phase 1.**
