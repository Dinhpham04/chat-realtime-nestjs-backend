# 🔍 Phân Tích Module Messages - Hiện Trạng & Kế Hoạch Triển Khai

## 📊 HIỆN TRẠNG MODULE MESSAGES

### ✅ **ĐÃ CÓ - FOUNDATION**

#### 1. Database Schemas (Hoàn chỉnh)
```typescript
✅ message.schema.ts - Core message entity
   - conversationId, senderId, messageType
   - content, replyTo, timestamps
   - isDeleted, isEdited, isSystemMessage
   - Indexes optimization đã có

✅ message-status.schema.ts - Delivery/Read status
   - Hybrid Redis/MongoDB model
   - messageId, userId, deviceId
   - Comprehensive delivery status tracking

✅ message-attachment.schema.ts - File attachments
   - File metadata, storage info
   - Media processing, thumbnails
   - Upload tracking, access control

✅ message-mention.schema.ts - User mentions
✅ message-reaction.schema.ts - Emoji reactions  
✅ message-edit.schema.ts - Edit history
```

#### 2. Type Definitions (Hoàn chỉnh)
```typescript
✅ message.types.ts - Core message types
   - MessageType enum (TEXT/IMAGE/VIDEO/AUDIO/FILE)
   - SystemMessageType, MessageStatus
   - LocationData, SystemMessageData

✅ message-attachment.types.ts - File attachment types
   - StorageProvider, UploadStatus, ScanResult
   - FileInfo, MediaInfo, AccessControl
   - Comprehensive type coverage
```

### ❌ **CHƯA CÓ - CẦN TRIỂN KHAI**

#### 2. Service Layer (Chưa có)
```typescript
❌ Không có service files nào
❌ Folder services/interfaces/ trống

CẦN VIẾT:
- MessageService - Core business logic
- MessageStatusService - Delivery tracking
- MessageValidationService - Content validation
- MessageNotificationService - Real-time events
```

#### 3. Controller Layer (Chưa có)
```typescript
❌ Folder controllers/ trống hoàn toàn

CẦN VIẾT:
- MessageController - REST API endpoints
- MessageStatusController - Status management
- MessageSearchController - Search & filtering
```

#### 4. WebSocket Gateway (Chưa có)
```typescript
❌ Folder gateways/ trống hoàn toàn

CẦN VIẾT:
- MessageGateway - Real-time messaging
- TypingIndicatorGateway - Typing status
- MessageStatusGateway - Read receipts
```

#### 5. DTOs & Validation (Chưa có)
```typescript
❌ Folder dto/ trống hoàn toàn

CẦN VIẾT:
- CreateMessageDto - Send message validation
- UpdateMessageDto - Edit message validation
- MessageQueryDto - Search parameters
- MessageResponseDto - API responses
```

#### 6. Module Configuration (Chưa có)
```typescript
❌ Không có messages.module.ts
❌ Chưa được import vào app.module.ts
```

---

## 🎯 **KẾ HOẠCH TRIỂN KHAI CHI TIẾT**

### **PHASE 1: CORE FOUNDATION** ⚡

#### 1.1 Repository Layer
```typescript
// 📁 src/modules/messages/interfaces/message-repository.interface.ts
interface IMessageRepository {
  // CRUD Operations
  create(messageData: CreateMessageData): Promise<Message>;
  findById(messageId: string): Promise<Message | null>;
  update(messageId: string, updateData: UpdateMessageData): Promise<Message>;
  softDelete(messageId: string): Promise<boolean>;
  
  // Conversation Queries
  findByConversation(
    conversationId: string, 
    pagination: PaginationParams
  ): Promise<PaginatedMessages>;
  
  // Advanced Queries
  findWithAttachments(messageId: string): Promise<MessageWithAttachments>;
  findReplies(parentMessageId: string): Promise<Message[]>;
  searchMessages(query: SearchMessageQuery): Promise<Message[]>;
  
  // Status Operations
  updateDeliveryStatus(messageId: string, userId: string, status: MessageDeliveryStatus): Promise<void>;
  getMessageStatus(messageId: string, userId: string): Promise<MessageStatus>;
}
```

#### 1.2 Repository Implementation
```typescript
// 📁 src/modules/messages/repositories/message.repository.ts
@Injectable()
export class MessageRepository implements IMessageRepository {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(MessageStatus.name) private statusModel: Model<MessageStatusDocument>,
  ) {}

  // Core CRUD với error handling
  // Optimized queries với population
  // Pagination với cursor-based
  // Status tracking với Redis integration
}
```

#### 1.3 Service Layer
```typescript
// 📁 src/modules/messages/services/message.service.ts
@Injectable()
export class MessageService {
  constructor(
    @Inject('IMessageRepository') private messageRepository: IMessageRepository,
    private conversationService: ConversationService,
    private notificationService: NotificationService,
  ) {}

  // Business Logic Methods:
  async sendTextMessage(sendMessageDto: SendMessageDto): Promise<MessageResponse>;
  async sendSystemMessage(systemMessageDto: SystemMessageDto): Promise<MessageResponse>;
  async editMessage(messageId: string, editDto: EditMessageDto): Promise<MessageResponse>;
  async deleteMessage(messageId: string, userId: string): Promise<boolean>;
  
  // Conversation Methods:
  async getConversationMessages(conversationId: string, pagination: PaginationParams): Promise<PaginatedMessages>;
  async markAsRead(messageId: string, userId: string): Promise<void>;
  async markAsDelivered(messageId: string, userId: string): Promise<void>;
  
  // Advanced Features:
  async replyToMessage(parentMessageId: string, replyDto: ReplyMessageDto): Promise<MessageResponse>;
  async forwardMessage(messageId: string, conversationIds: string[]): Promise<MessageResponse[]>;
}
```

### **PHASE 2: API LAYER** 🌐

#### 2.1 DTOs & Validation
```typescript
// 📁 src/modules/messages/dto/send-message.dto.ts
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  content?: string;

  @IsEnum(MessageType)
  messageType: MessageType;

  @IsString()
  @IsOptional()
  replyTo?: string;

  @IsArray()
  @IsOptional()
  mentions?: string[];
}

// Tương tự cho: EditMessageDto, ReplyMessageDto, MessageQueryDto
```

#### 2.2 REST API Controller
```typescript
// 📁 src/modules/messages/controllers/message.controller.ts
@Controller('messages')
@ApiTags('Messages')
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a text message' })
  async sendMessage(@Body() sendMessageDto: SendMessageDto): Promise<MessageResponse> {
    return this.messageService.sendTextMessage(sendMessageDto);
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get conversation messages with pagination' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() paginationDto: MessagePaginationDto
  ): Promise<PaginatedMessages> {
    return this.messageService.getConversationMessages(conversationId, paginationDto);
  }

  @Put(':messageId')
  @ApiOperation({ summary: 'Edit message content' })
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() editDto: EditMessageDto
  ): Promise<MessageResponse> {
    return this.messageService.editMessage(messageId, editDto);
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete message (soft delete)' })
  async deleteMessage(@Param('messageId') messageId: string): Promise<{ success: boolean }> {
    const result = await this.messageService.deleteMessage(messageId, 'currentUserId');
    return { success: result };
  }

  @Post(':messageId/read')
  @ApiOperation({ summary: 'Mark message as read' })
  async markAsRead(@Param('messageId') messageId: string): Promise<{ success: boolean }> {
    await this.messageService.markAsRead(messageId, 'currentUserId');
    return { success: true };
  }
}
```

### **PHASE 3: REAL-TIME LAYER** ⚡

#### 3.1 WebSocket Gateway
```typescript
// 📁 src/modules/messages/gateways/message.gateway.ts
@WebSocketGateway({
  namespace: 'messages',
  cors: { origin: '*' }
})
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private messageService: MessageService) {}

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto
  ): Promise<void> {
    try {
      const message = await this.messageService.sendTextMessage(sendMessageDto);
      
      // Emit to conversation participants
      this.server.to(sendMessageDto.conversationId).emit('new_message', message);
      
      // Emit delivery status
      this.server.to(sendMessageDto.conversationId).emit('message_delivered', {
        messageId: message.id,
        timestamp: new Date()
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to send message', error: error.message });
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId: string }
  ): Promise<void> {
    client.to(data.conversationId).emit('user_typing', {
      userId: data.userId,
      isTyping: true
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId: string }
  ): Promise<void> {
    client.to(data.conversationId).emit('user_typing', {
      userId: data.userId,
      isTyping: false
    });
  }

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; userId: string }
  ): Promise<void> {
    await this.messageService.markAsRead(data.messageId, data.userId);
    
    // Emit read receipt to sender
    this.server.emit('message_read', {
      messageId: data.messageId,
      readBy: data.userId,
      timestamp: new Date()
    });
  }

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
  }
}
```

### **PHASE 4: MODULE CONFIGURATION** ⚙️

#### 4.1 Messages Module
```typescript
// 📁 src/modules/messages/messages.module.ts
@Module({
  imports: [
    // MongoDB Schemas
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: MessageStatus.name, schema: MessageStatusSchema },
      { name: MessageAttachment.name, schema: MessageAttachmentSchema },
      { name: MessageMention.name, schema: MessageMentionSchema },
      { name: MessageReaction.name, schema: MessageReactionSchema },
      { name: MessageEdit.name, schema: MessageEditSchema },
    ]),

    // External Dependencies
    ConversationsModule,
    // FilesModule, // Sẽ thêm sau khi Files Module hoàn thành
  ],

  controllers: [
    MessageController,
  ],

  providers: [
    // Repository
    MessageRepository,
    {
      provide: 'IMessageRepository',
      useClass: MessageRepository,
    },

    // Services
    MessageService,
    MessageStatusService,
    MessageValidationService,

    // WebSocket Gateway
    MessageGateway,
  ],

  exports: [
    // Export cho external modules
    MessageService,
    MessageRepository,
    'IMessageRepository',
  ],
})
export class MessagesModule {}
```

---

## 📋 **CHECKLIST TRIỂN KHAI**

### ✅ **Phase 1: Core Foundation**
- [ ] **Repository Interface** - Define all method signatures
- [ ] **Repository Implementation** - MongoDB operations với error handling
- [ ] **Message Service** - Core business logic
- [ ] **Status Service** - Delivery/read tracking
- [ ] **Validation Service** - Content & security validation

### ✅ **Phase 2: API Layer**  
- [ ] **DTOs** - Request/Response validation objects
- [ ] **REST Controller** - HTTP endpoints với Swagger docs
- [ ] **Error Handling** - Custom exceptions & filters
- [ ] **Authentication** - Guards cho protected routes

### ✅ **Phase 3: Real-time Layer**
- [ ] **WebSocket Gateway** - Real-time messaging events
- [ ] **Room Management** - Conversation-based rooms
- [ ] **Typing Indicators** - Real-time typing status
- [ ] **Read Receipts** - Message status broadcasting

### ✅ **Phase 4: Integration**
- [ ] **Module Configuration** - Complete dependency injection
- [ ] **App Module Import** - Add to main application
- [ ] **Testing** - Unit tests cho services & controllers
- [ ] **Documentation** - API documentation & examples

---

## 🚀 **RECOMMENDED START ORDER**

1. **Repository Layer** (Foundation) - 2-3 ngày
2. **Service Layer** (Business Logic) - 3-4 ngày  
3. **Controller Layer** (REST API) - 1-2 ngày
4. **WebSocket Gateway** (Real-time) - 2-3 ngày
5. **Module Integration** (Configuration) - 1 ngày

**Total Estimate: 9-13 ngày development**

Bạn muốn bắt đầu từ đâu? Tôi khuyên nên bắt đầu với **Repository Layer** vì nó là foundation cho tất cả các layer khác.
