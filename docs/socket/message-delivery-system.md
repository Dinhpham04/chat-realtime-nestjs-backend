# Message Delivery System - Hệ thống Gửi Tin nhắn Đáng tin cậy

## 1. Cơ chế xác định tin nhắn gửi thành công

### Message Status Lifecycle:
```
SENDING → SENT → PROCESSED → DELIVERED → READ
```

### Các trạng thái tin nhắn:

1. **SENDING**: Client đang gửi tin nhắn
2. **SENT**: Server đã nhận được tin nhắn từ client
3. **PROCESSED**: Server đã lưu tin nhắn vào database thành công
4. **DELIVERED**: Tin nhắn đã được gửi đến participant
5. **READ**: Participant đã đọc tin nhắn

### Flow xử lý trong ChatGateway:

```typescript
// 1. Client gửi tin nhắn
@SubscribeMessage('send_message')
async handleSendMessage(client: Socket, data: SendMessageDto) {
    // 2. Server gửi acknowledgment SENT
    client.emit('message_received', {
        localId: data.localId,
        status: 'sent',
        timestamp: Date.now()
    });
    
    // 3. Lưu vào database
    const message = await this.messagesService.sendMessage(createMessageDto, userContext);
    
    // 4. Server gửi acknowledgment PROCESSED
    client.emit('message_received', {
        localId: data.localId,
        serverId: message.id,
        status: 'processed',
        timestamp: message.createdAt
    });
    
    // 5. Broadcast đến participants
    client.to(`conversation:${conversationId}`).emit('new_message', messageData);
    
    // 6. Queue cho offline participants và mark delivered cho online participants
    await this.queueMessageForOfflineParticipants(message, participants, userId);
    await this.updateDeliveryStatusForOnlineUsers(message.id, participants);
}
```

## 2. Xử lý khi Participant bị Disconnect

### Message Queuing System:

1. **Detect Offline Participants**:
   - Kiểm tra `connectedUsers` Map để xác định participant nào offline
   - Queue tin nhắn cho những user offline

2. **Message Queue Structure**:
```typescript
interface QueuedMessage {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: string;
    timestamp: number;
    senderName: string;
    status: 'queued';
    queuedAt: number;
}
```

3. **Deliver on Reconnect**:
```typescript
async handleConnection(client: Socket) {
    // ... authentication logic
    
    // Deliver all queued messages
    await this.messageQueueService.deliverQueuedMessages(user.userId, client);
    
    // Send delivery confirmations
    await this.sendDeliveryConfirmationsForQueuedMessages(user.userId, client);
}
```

## 3. Delivery Confirmation System

### Client-side Confirmation:
```typescript
// Client nhận tin nhắn và gửi confirmation
socket.on('new_message', (messageData) => {
    // Display message in UI
    displayMessage(messageData);
    
    // Send delivery confirmation
    socket.emit('confirm_message_delivery', {
        messageId: messageData.id,
        conversationId: messageData.conversationId,
        deliveredAt: Date.now()
    });
});
```

### Server-side Confirmation Handler:
```typescript
@SubscribeMessage('confirm_message_delivery')
async handleConfirmMessageDelivery(client: Socket, data: DeliveryDto) {
    // Update delivery status in database
    await this.messagesService.markAsDelivered(data.messageId, userId, data.deliveredAt);
    
    // Notify sender about successful delivery
    client.to(`conversation:${data.conversationId}`).emit('message_delivery_confirmed', {
        messageId: data.messageId,
        userId: userId,
        status: 'delivered_confirmed',
        timestamp: data.deliveredAt
    });
    
    // Remove from queue
    await this.messageQueueService.removeQueuedMessage(userId, data.messageId);
}
```

## 4. Message Retry Mechanism

### Auto-retry for Failed Messages:
```typescript
@SubscribeMessage('retry_message_delivery')
async handleRetryMessageDelivery(client: Socket, data: RetryDto) {
    // Get message from database
    const message = await this.messagesService.getMessageById(data.messageId);
    
    // Check permissions
    if (message.senderId !== userId) {
        throw new Error('Permission denied');
    }
    
    // Re-broadcast message
    this.server.to(`conversation:${data.conversationId}`).emit('new_message', {
        ...messageData,
        isRetry: true
    });
}
```

### Client-side Retry Logic:
```typescript
// Retry failed messages after timeout
setTimeout(() => {
    if (message.status === 'sent' && !message.serverId) {
        socket.emit('retry_message_delivery', {
            messageId: message.localId,
            conversationId: message.conversationId
        });
    }
}, MESSAGE_TIMEOUT); // 30 seconds
```

## 5. Delivery Status Tracking

### Check Message Delivery Status:
```typescript
@SubscribeMessage('get_message_delivery_status')
async handleGetMessageDeliveryStatus(client: Socket, data: StatusQueryDto) {
    const deliveryStatuses = await this.messagesService.getMessagesDeliveryStatus(
        data.messageIds, 
        userId
    );
    
    client.emit('message_delivery_status', {
        conversationId: data.conversationId,
        deliveryStatuses: deliveryStatuses
    });
}
```

### Delivery Status Response:
```typescript
interface DeliveryStatus {
    messageId: string;
    participantStatuses: Array<{
        userId: string;
        status: 'pending' | 'delivered' | 'read';
        timestamp?: number;
    }>;
}
```

## 6. Implementation Requirements

### Service Methods cần implement:

1. **MessageQueueService**:
   - `queueMessage(userId: string, message: QueuedMessage)`
   - `getQueuedMessages(userId: string): Promise<QueuedMessage[]>`
   - `removeQueuedMessage(userId: string, messageId: string)`
   - `clearDeliveredMessages(userId: string)`

2. **MessagesService**:
   - `markAsDelivered(messageId: string, userId: string, deliveredAt: number)`
   - `getMessageById(messageId: string): Promise<Message>`
   - `getMessagesDeliveryStatus(messageIds: string[], requesterId: string)`

## 7. Error Handling & Recovery

### Timeout Handling:
```typescript
const MESSAGE_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

// Client-side timeout logic
const timeoutId = setTimeout(() => {
    if (!messageAcknowledged) {
        // Mark as failed and show retry option
        updateMessageStatus(localId, 'failed');
        showRetryOption(localId);
    }
}, MESSAGE_TIMEOUT);
```

### Network Recovery:
```typescript
// Reconnection logic
socket.on('connect', () => {
    // Request status sync for recent messages
    socket.emit('request_status_sync', {
        conversationId: currentConversationId,
        since: Date.now() - (5 * 60 * 1000) // Last 5 minutes
    });
});
```

## 8. Benefits của hệ thống này:

1. **Reliability**: Đảm bảo tin nhắn không bị mất khi participant offline
2. **Visibility**: Sender biết được trạng thái delivery của từng tin nhắn
3. **Recovery**: Automatic retry và manual retry cho failed messages
4. **Performance**: Queue system giảm tải cho real-time connections
5. **User Experience**: Clear status indicators và feedback

## 9. Socket Events Summary:

### Client → Server:
- `send_message`: Gửi tin nhắn mới
- `confirm_message_delivery`: Xác nhận đã nhận tin nhắn
- `retry_message_delivery`: Retry tin nhắn failed
- `get_message_delivery_status`: Query delivery status

### Server → Client:
- `message_received`: Acknowledgment cho sender
- `new_message`: Broadcast tin nhắn mới
- `message_delivery_confirmed`: Xác nhận delivery thành công
- `message_delivery_status`: Response delivery status
- `message_retry_sent`: Xác nhận retry thành công

Hệ thống này đảm bảo tính đáng tin cậy cao cho việc gửi tin nhắn trong ứng dụng chat real-time.
