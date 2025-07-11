# 5. Kết nối Database (MongoDB/Mongoose, Redis, TypeORM)

## Tổng quan về Database trong NestJS

NestJS hỗ trợ nhiều loại database và ORM/ODM:
- **MongoDB** với **Mongoose** (NoSQL Document)
- **PostgreSQL/MySQL** với **TypeORM** (SQL Relational)
- **Redis** (In-memory cache/session store)
- **Prisma** (Modern ORM)
- **Sequelize** (SQL ORM)

### Kiến trúc Database Layer
```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Controller  │──►│   Service   │──►│ Repository  │
└─────────────┘   └─────────────┘   └─────────────┘
                                           │
                                           ▼
                                  ┌─────────────┐
                                  │  Database   │
                                  └─────────────┘
```

---

## 1. MongoDB với Mongoose

### Cài đặt packages
```bash
npm install @nestjs/mongoose mongoose
npm install -D @types/mongoose
```

### Cấu hình kết nối MongoDB
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Cho phép dùng config ở mọi nơi
    }),
    
    // Cách 1: Kết nối đơn giản
    MongooseModule.forRoot('mongodb://localhost:27017/chat-app'),
    
    // Cách 2: Kết nối với config (Recommended)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // Các options khác
        maxPoolSize: 10, // Số connection tối đa
        serverSelectionTimeoutMS: 5000, // Timeout khi connect
        socketTimeoutMS: 45000, // Timeout cho socket
        bufferCommands: false, // Disable mongoose buffering
        bufferMaxEntries: 0, // Disable mongoose buffering
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Định nghĩa Schema
```typescript
// schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Document type để có đầy đủ methods của mongoose
export type UserDocument = User & Document;

@Schema({
  timestamps: true, // Tự động tạo createdAt, updatedAt
  versionKey: false, // Tắt __v field
})
export class User {
  // _id sẽ tự động được tạo bởi MongoDB
  _id: Types.ObjectId;

  @Prop({ 
    required: true, 
    unique: true,
    trim: true, // Tự động trim whitespace
    lowercase: true // Tự động lowercase
  })
  username: string;

  @Prop({ 
    required: true, 
    unique: true,
    match: /^\S+@\S+\.\S+$/ // Regex validation
  })
  email: string;

  @Prop({ 
    required: true,
    minlength: 6 // Validation ở level schema
  })
  password: string;

  @Prop({ 
    default: 'user',
    enum: ['user', 'admin', 'moderator'] // Enum validation
  })
  role: string;

  @Prop({ default: null })
  avatar?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: Date.now })
  lastSeen: Date;

  // Virtual field (không lưu vào DB)
  @Prop({ 
    type: String,
    get: function() {
      return `${this.firstName} ${this.lastName}`;
    }
  })
  fullName?: string;

  // Timestamps sẽ tự động add
  createdAt: Date;
  updatedAt: Date;
}

// Tạo schema từ class
export const UserSchema = SchemaFactory.createForClass(User);

// Thêm index cho performance
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware (chạy trước khi save)
UserSchema.pre('save', async function(next) {
  // Hash password nếu password thay đổi
  if (!this.isModified('password')) return next();
  
  const bcrypt = require('bcrypt');
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(candidatePassword, this.password);
};

// Static methods
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email });
};
```

### Schema cho Chat Message
```typescript
// schemas/message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  _id: Types.ObjectId;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User', // Reference đến User collection
    required: true 
  })
  sender: Types.ObjectId | User; // Có thể là ObjectId hoặc populated User

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Conversation',
    required: true 
  })
  conversation: Types.ObjectId;

  @Prop({ 
    required: true,
    maxlength: 1000 
  })
  content: string;

  @Prop({ 
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text'
  })
  type: string;

  @Prop({
    type: {
      url: String,
      filename: String,
      size: Number,
      mimetype: String,
    }
  })
  attachment?: {
    url: string;
    filename: string;
    size: number;
    mimetype: string;
  };

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ default: null })
  editedAt: Date;

  @Prop({ 
    type: [{ 
      user: { type: Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now }
    }],
    default: []
  })
  readBy: Array<{
    user: Types.ObjectId;
    readAt: Date;
  }>;

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Message',
    default: null 
  })
  replyTo?: Types.ObjectId; // Reply to another message

  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound indexes cho query hiệu quả
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, createdAt: -1 });
```

### Module Setup
```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema }, // Đăng ký schema
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export để dùng ở module khác
})
export class UsersModule {}
```

### Service với Mongoose
```typescript
// users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>, // Inject model
  ) {}

  // Tạo user mới
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const createdUser = new this.userModel(createUserDto);
      const savedUser = await createdUser.save();
      
      // Loại bỏ password khi trả về
      const { password, ...result } = savedUser.toObject();
      return result as User;
    } catch (error) {
      if (error.code === 11000) { // Duplicate key error
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }

  // Tìm tất cả users với pagination
  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      this.userModel
        .find({ isActive: true }) // Filter
        .select('-password') // Loại bỏ password field
        .sort({ createdAt: -1 }) // Sort mới nhất trước
        .skip(skip)
        .limit(limit)
        .lean() // Trả về plain object, nhanh hơn
        .exec(),
      
      this.userModel.countDocuments({ isActive: true })
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Tìm user theo ID
  async findOne(id: string): Promise<User> {
    const user = await this.userModel
      .findById(id)
      .select('-password')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user as User;
  }

  // Tìm user theo email (cho login)
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Update user
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id, 
        updateUserDto, 
        { 
          new: true, // Trả về document sau khi update
          runValidators: true, // Chạy schema validation
        }
      )
      .select('-password')
      .lean()
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return updatedUser as User;
  }

  // Soft delete (đánh dấu isActive = false)
  async remove(id: string): Promise<void> {
    const result = await this.userModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();

    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  // Hard delete (xóa hoàn toàn)
  async hardDelete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    
    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  // Tìm kiếm user
  async search(query: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    const searchFilter: FilterQuery<UserDocument> = {
      isActive: true,
      $or: [
        { username: { $regex: query, $options: 'i' } }, // Case insensitive
        { email: { $regex: query, $options: 'i' } },
      ],
    };

    const [users, total] = await Promise.all([
      this.userModel
        .find(searchFilter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      
      this.userModel.countDocuments(searchFilter)
    ]);

    return { users, total };
  }

  // Bulk operations // cập nhật hàng loạt
  async bulkUpdate(filter: FilterQuery<UserDocument>, update: UpdateQuery<UserDocument>) {
    return this.userModel.updateMany(filter, update).exec();
  }

  // Aggregation example - Thống kê users theo role
  async getUserStats() {
    return this.userModel.aggregate([
      { $match: { isActive: true } },
      { 
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          avgLastSeen: { $avg: '$lastSeen' }
        }
      },
      { $sort: { count: -1 } }
    ]).exec();
  }
}
```

---

## 2. TypeORM cho SQL Database

### Cài đặt packages
```bash
npm install @nestjs/typeorm typeorm pg
npm install -D @types/pg
```

### Cấu hình TypeORM
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'], // Auto-load entities
        synchronize: configService.get('NODE_ENV') !== 'production', // Chỉ sync khi dev
        logging: configService.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        migrationsRun: true, // Tự động chạy migration
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Entity Definition
```typescript
// entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Message } from './message.entity';

@Entity('users') // Tên table
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID primary key
  id: string;

  @Column({ 
    unique: true,
    length: 50,
  })
  @Index() // Index cho performance
  username: string;

  @Column({ 
    unique: true,
    length: 100,
  })
  @Index()
  email: string;

  @Column({ select: false }) // Không select password by default
  password: string;

  @Column({
    type: 'enum',
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  })
  role: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeen: Date;

  // Relationships
  @OneToMany(() => Message, message => message.sender)
  sentMessages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Message Entity với Relations
```typescript
// entities/message.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text',
  })
  type: string;

  @Column({ type: 'jsonb', nullable: true }) // PostgreSQL JSONB
  attachment?: {
    url: string;
    filename: string;
    size: number;
    mimetype: string;
  };

  @Column({ default: false })
  isEdited: boolean;

  @Column({ nullable: true })
  editedAt?: Date;

  // Foreign Keys với Relations
  @Column('uuid')
  @Index()
  senderId: string;

  @ManyToOne(() => User, user => user.sentMessages, { 
    onDelete: 'CASCADE' // Xóa user thì xóa luôn messages
  })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column('uuid')
  @Index()
  conversationId: string;

  @ManyToOne(() => Conversation, conversation => conversation.messages)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Composite index cho query hiệu quả
@Index(['conversationId', 'createdAt'])
@Index(['senderId', 'createdAt'])
export class MessageIndexes {}
```

### Repository Pattern với TypeORM
```typescript
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Like } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>, // Inject repository
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto); // Tạo instance
    return this.usersRepository.save(user); // Save vào database
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [users, total] = await this.usersRepository.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'username', 'email', 'role', 'avatar', 'createdAt'], // Chọn fields
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'username', 'email', 'role', 'avatar', 'createdAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  // Query với JOIN
  async findUserWithMessages(userId: string) {
    return this.usersRepository.findOne({
      where: { id: userId },
      relations: ['sentMessages'], // Eager loading
      select: ['id', 'username', 'email'],
    });
  }

  // Raw SQL query
  async getUsersWithMessageCount() {
    return this.usersRepository
      .createQueryBuilder('user')
      .leftJoin('user.sentMessages', 'message')
      .addSelect('COUNT(message.id)', 'messageCount')
      .groupBy('user.id')
      .getRawMany();
  }

  // Transaction example
  async updateUserAndLog(userId: string, updateData: Partial<User>) {
    return this.usersRepository.manager.transaction(async manager => {
      // Update user
      await manager.update(User, userId, updateData);
      
      // Log the change (giả sử có UserLog entity)
      // await manager.save(UserLog, { userId, action: 'update', data: updateData });
      
      return manager.findOne(User, { where: { id: userId } });
    });
  }
}
```

---

## 3. Redis cho Caching và Session

### Cài đặt packages
```bash
npm install @nestjs/redis redis
npm install -D @types/redis
```

### Cấu hình Redis
```typescript
// redis.module.ts
import { Module, Global } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs/redis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global() // Làm cho RedisModule có sẵn ở mọi nơi
@Module({
  imports: [
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        config: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
          db: 0, // Database number
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
```

### Redis Service
```typescript
// redis/redis.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // Basic operations
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serializedValue);
    } else {
      await this.redis.set(key, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  // Hash operations (cho object caching)
  async hset(key: string, field: string, value: any): Promise<void> {
    await this.redis.hset(key, field, JSON.stringify(value));
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.redis.hget(key, field);
    return value ? JSON.parse(value) : null;
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const hash = await this.redis.hgetall(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(hash)) {
      result[field] = JSON.parse(value);
    }
    
    return result;
  }

  // List operations (cho queue, notifications)
  async lpush(key: string, ...values: any[]): Promise<number> {
    const serializedValues = values.map(v => JSON.stringify(v));
    return this.redis.lpush(key, ...serializedValues);
  }

  async rpop<T>(key: string): Promise<T | null> {
    const value = await this.redis.rpop(key);
    return value ? JSON.parse(value) : null;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const values = await this.redis.lrange(key, start, stop);
    return values.map(v => JSON.parse(v));
  }

  // Set operations (cho online users, rooms)
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.redis.sismember(key, member);
    return result === 1;
  }

  // Pattern matching
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  // Expire
  async expire(key: string, seconds: number): Promise<void> {
    await this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }
}
```

### Cache Interceptor với Redis
```typescript
// interceptors/cache.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);

    // Chỉ cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Kiểm tra cache
    const cachedResult = await this.redisService.get(cacheKey);
    if (cachedResult) {
      console.log(`Cache hit: ${cacheKey}`);
      return of(cachedResult);
    }

    // Nếu không có cache, thực thi và lưu cache
    return next.handle().pipe(
      tap(async (data) => {
        console.log(`Cache miss: ${cacheKey}`);
        await this.redisService.set(cacheKey, data, 300); // Cache 5 phút
      }),
    );
  }

  private generateCacheKey(request: any): string {
    const { method, url, query, user } = request;
    const userId = user?.id || 'anonymous';
    return `cache:${method}:${url}:${JSON.stringify(query)}:${userId}`;
  }
}
```

### Session Store với Redis
```typescript
// session/session.service.ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface UserSession {
  userId: string;
  username: string;
  role: string;
  loginAt: Date;
  lastActivity: Date;
}

@Injectable()
export class SessionService {
  constructor(private readonly redisService: RedisService) {}

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  async createSession(sessionId: string, userData: Omit<UserSession, 'loginAt' | 'lastActivity'>): Promise<void> {
    const session: UserSession = {
      ...userData,
      loginAt: new Date(),
      lastActivity: new Date(),
    };

    const sessionKey = this.getSessionKey(sessionId);
    const userSessionsKey = this.getUserSessionsKey(userData.userId);

    // Lưu session data
    await this.redisService.set(sessionKey, session, 3600 * 24); // 24 hours

    // Thêm session ID vào danh sách sessions của user
    await this.redisService.sadd(userSessionsKey, sessionId);
    await this.redisService.expire(userSessionsKey, 3600 * 24);
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    return this.redisService.get<UserSession>(this.getSessionKey(sessionId));
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = new Date();
      await this.redisService.set(this.getSessionKey(sessionId), session, 3600 * 24);
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.redisService.del(this.getSessionKey(sessionId));
      await this.redisService.srem(this.getUserSessionsKey(session.userId), sessionId);
    }
  }

  async destroyAllUserSessions(userId: string): Promise<void> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await this.redisService.smembers(userSessionsKey);

    // Xóa tất cả sessions
    for (const sessionId of sessionIds) {
      await this.redisService.del(this.getSessionKey(sessionId));
    }

    // Xóa danh sách sessions
    await this.redisService.del(userSessionsKey);
  }

  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const sessionIds = await this.redisService.smembers(userSessionsKey);

    const sessions: UserSession[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }
}
```

---

## 4. Chat Application Database Design

### MongoDB Schema cho Chat App
```typescript
// schemas/conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  _id: Types.ObjectId;

  @Prop({ 
    required: true,
    enum: ['direct', 'group'],
  })
  type: string;

  @Prop({ required: false }) // Chỉ có với group chat
  name?: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  avatar?: string;

  @Prop({ 
    type: [{ type: Types.ObjectId, ref: 'User' }],
    required: true 
  })
  participants: Types.ObjectId[];

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'User',
    required: function() { return this.type === 'group'; }
  })
  creator?: Types.ObjectId; // Chỉ có với group chat

  @Prop({ 
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: []
  })
  admins: Types.ObjectId[]; // Group admins

  @Prop({ 
    type: Types.ObjectId, 
    ref: 'Message',
    default: null 
  })
  lastMessage?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ type: 1, isActive: 1 });
```

### Service cho Conversation
```typescript
// conversations/conversations.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { Message, MessageDocument } from '../schemas/message.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // Tạo direct conversation
  async createDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Kiểm tra xem đã có conversation giữa 2 users chưa
    const existingConversation = await this.conversationModel
      .findOne({
        type: 'direct',
        participants: { 
          $all: [
            new Types.ObjectId(userId1), 
            new Types.ObjectId(userId2)
          ],
          $size: 2
        }
      })
      .lean()
      .exec();

    if (existingConversation) {
      return existingConversation as Conversation;
    }

    // Tạo conversation mới
    const conversation = new this.conversationModel({
      type: 'direct',
      participants: [userId1, userId2],
    });

    return conversation.save();
  }

  // Tạo group conversation
  async createGroupConversation(
    creatorId: string,
    name: string,
    participantIds: string[],
    description?: string
  ): Promise<Conversation> {
    const conversation = new this.conversationModel({
      type: 'group',
      name,
      description,
      creator: creatorId,
      participants: [creatorId, ...participantIds],
      admins: [creatorId],
    });

    return conversation.save();
  }

  // Lấy conversations của user
  async getUserConversations(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const conversations = await this.conversationModel
      .find({
        participants: new Types.ObjectId(userId),
        isActive: true,
      })
      .populate('participants', 'username avatar lastSeen')
      .populate('lastMessage')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username avatar'
        }
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return conversations;
  }

  // Lấy messages của conversation
  async getConversationMessages(
    conversationId: string, 
    userId: string, 
    page: number = 1, 
    limit: number = 50
  ) {
    // Kiểm tra user có thuộc conversation không
    const conversation = await this.conversationModel
      .findOne({
        _id: conversationId,
        participants: new Types.ObjectId(userId),
      })
      .lean()
      .exec();

    if (!conversation) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversation: conversationId })
      .populate('sender', 'username avatar')
      .populate('replyTo')
      .sort({ createdAt: -1 }) // Mới nhất trước
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    return messages.reverse(); // Reverse để tin nhắn cũ ở trên
  }

  // Gửi message
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: string = 'text',
    replyToId?: string
  ): Promise<Message> {
    // Kiểm tra conversation tồn tại và user có quyền
    const conversation = await this.conversationModel
      .findOne({
        _id: conversationId,
        participants: new Types.ObjectId(senderId),
        isActive: true,
      })
      .exec();

    if (!conversation) {
      throw new ForbiddenException('Conversation not found or access denied');
    }

    // Tạo message
    const message = new this.messageModel({
      sender: senderId,
      conversation: conversationId,
      content,
      type,
      replyTo: replyToId || null,
    });

    const savedMessage = await message.save();

    // Update lastMessage của conversation
    await this.conversationModel
      .findByIdAndUpdate(conversationId, {
        lastMessage: savedMessage._id,
        updatedAt: new Date(),
      })
      .exec();

    // Populate sender info
    await savedMessage.populate('sender', 'username avatar');

    return savedMessage.toObject() as Message;
  }

  // Thêm participant vào group
  async addParticipant(conversationId: string, adminId: string, newParticipantId: string) {
    const conversation = await this.conversationModel
      .findOne({
        _id: conversationId,
        type: 'group',
        admins: new Types.ObjectId(adminId),
      })
      .exec();

    if (!conversation) {
      throw new ForbiddenException('Only group admins can add participants');
    }

    // Kiểm tra user đã là participant chưa
    if (conversation.participants.includes(new Types.ObjectId(newParticipantId))) {
      throw new ForbiddenException('User is already a participant');
    }

    conversation.participants.push(new Types.ObjectId(newParticipantId));
    return conversation.save();
  }

  // Remove participant
  async removeParticipant(conversationId: string, adminId: string, participantId: string) {
    const conversation = await this.conversationModel
      .findOne({
        _id: conversationId,
        type: 'group',
        admins: new Types.ObjectId(adminId),
      })
      .exec();

    if (!conversation) {
      throw new ForbiddenException('Only group admins can remove participants');
    }

    conversation.participants = conversation.participants.filter(
      p => !p.equals(new Types.ObjectId(participantId))
    );

    return conversation.save();
  }
}
```

---

## 5. Best Practices & Performance

### 1. Database Indexing
```typescript
// MongoDB Indexes
db.users.createIndex({ "username": 1 }, { unique: true })
db.users.createIndex({ "email": 1 }, { unique: true })
db.messages.createIndex({ "conversation": 1, "createdAt": -1 })
db.conversations.createIndex({ "participants": 1 })

// PostgreSQL Indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
```

### 2. Connection Pooling
```typescript
// MongoDB connection pooling
MongooseModule.forRoot(uri, {
  maxPoolSize: 10, // Số connection tối đa
  minPoolSize: 5,  // Số connection tối thiểu
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})

// TypeORM connection pooling
TypeOrmModule.forRoot({
  // ...
  extra: {
    connectionLimit: 10, // Pool size
    acquireTimeout: 60000,
    timeout: 60000,
  },
})
```

### 3. Query Optimization
```typescript
// Bad - N+1 query problem
for (const conversation of conversations) {
  conversation.lastMessage = await messageModel.findById(conversation.lastMessageId);
}

// Good - Populate/Join
const conversations = await conversationModel
  .find(filter)
  .populate('lastMessage')
  .exec();

// Good - Aggregation pipeline
const conversationsWithMessageCount = await conversationModel.aggregate([
  { $match: { participants: userId } },
  {
    $lookup: {
      from: 'messages',
      localField: '_id',
      foreignField: 'conversation',
      as: 'messages'
    }
  },
  {
    $addFields: {
      messageCount: { $size: '$messages' }
    }
  },
  { $project: { messages: 0 } } // Exclude messages array
]);
```

### 4. Caching Strategy
```typescript
// Cache user data
@UseInterceptors(CacheInterceptor)
@Get('profile')
async getProfile(@User() user) {
  return this.usersService.findOne(user.id);
}

// Cache conversation list
async getUserConversations(userId: string) {
  const cacheKey = `user_conversations:${userId}`;
  
  let conversations = await this.redisService.get(cacheKey);
  if (!conversations) {
    conversations = await this.conversationModel.find(...);
    await this.redisService.set(cacheKey, conversations, 300); // 5 minutes
  }
  
  return conversations;
}

// Invalidate cache khi có thay đổi
async sendMessage(...) {
  const message = await this.messageModel.save(...);
  
  // Invalidate related caches
  await this.redisService.del(`user_conversations:${senderId}`);
  await this.redisService.del(`conversation_messages:${conversationId}`);
  
  return message;
}
```

---

## 6. Environment Configuration

### .env file
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/chat-app
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chat-app

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=chat_app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# App
NODE_ENV=development
PORT=3000
```

### Database Module
```typescript
// database/database.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),

    // PostgreSQL (if using both)
    TypeOrmModule.forRootAsync({
      name: 'postgres', // Named connection
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
```

---

**Kết luận**: Database integration là phần core của chat application. MongoDB phù hợp cho real-time messaging, TypeORM tốt cho structured data, Redis quan trọng cho caching và session management. Việc kết hợp cả 3 sẽ tạo ra một hệ thống chat robust và scalable.

---
**Tiếp theo: Authentication & Authorization (JWT, Guard, Session)**
