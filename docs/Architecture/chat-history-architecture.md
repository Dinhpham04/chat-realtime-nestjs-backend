# Chat History Architecture - Hybrid Approach

## 🎯 Recommended Solution: REST API for History + Socket.IO for Real-time

### Lý do chọn REST API cho Chat History:

1. **Reliability**: HTTP requests có retry mechanism built-in
2. **Caching**: Browser cache, CDN cache cho performance
3. **Battery Efficient**: Không cần maintain persistent connection
4. **Error Handling**: Standard HTTP status codes
5. **Offline Support**: Có thể cache data locally
6. **Scalability**: Stateless, dễ scale horizontal

### Architecture Flow:

```
App Launch/Room Enter
        ↓
    REST API Call
  GET /conversations/{id}/messages
        ↓
    Load Chat History
        ↓
    Connect Socket.IO
        ↓
    Real-time Updates
```

## 📱 Implementation Plan

### 1. REST API Endpoints (Messages Controller)

```typescript
// GET /api/v1/conversations/{conversationId}/messages
@Get(':conversationId/messages')
async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Query() pagination: MessagePaginationDto,
    @Req() req: AuthenticatedRequest
): Promise<PaginatedMessagesResponseDto>

// GET /api/v1/conversations/{conversationId}/messages/recent
@Get(':conversationId/messages/recent')
async getRecentMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit', new DefaultValuePipe(50)) limit: number,
    @Req() req: AuthenticatedRequest
): Promise<MessageResponseDto[]>
```

### 2. Socket.IO for Real-time Updates Only

```typescript
// Connect sau khi đã load history
socket.connect()

// Chỉ handle real-time events
socket.on('new_message', handleNewMessage)
socket.on('message_delivered', handleDelivered)
socket.on('message_read', handleRead)
```

### 3. Client-side Flow

```typescript
// 1. Load history via REST API
const history = await fetch(`/api/conversations/${conversationId}/messages`)

// 2. Render messages
renderMessages(history.messages)

// 3. Connect socket for real-time
connectSocket()

// 4. Handle real-time updates
socket.on('new_message', (message) => {
    appendMessage(message) // Chỉ append, không replace
})
```

## 🚀 Hybrid Benefits

1. **Fast Initial Load**: REST API với cache
2. **Real-time Updates**: Socket.IO cho new messages
3. **Offline Support**: Cache REST responses
4. **Battery Efficient**: Connect socket chỉ khi active
5. **Reliable**: Fallback mechanisms

## 🔧 Implementation Details

### Pagination Strategy:
- **Cursor-based**: Dùng message timestamp
- **Limit**: 50 messages per page
- **Direction**: Load older messages khi scroll up

### Caching Strategy:
- **Browser Cache**: 5 minutes for recent messages
- **Local Storage**: Offline support
- **CDN Cache**: For file attachments

### Real-time Strategy:
- **Socket.IO**: Chỉ khi app active
- **Background**: Disconnect khi app background
- **Reconnect**: Auto-reconnect với status sync
