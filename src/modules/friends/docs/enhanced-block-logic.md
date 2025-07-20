# Enhanced Block/Unblock Logic Documentation

## 🎯 Overview

Đã cải tiến logic Block/Unblock để giải quyết 2 vấn đề quan trọng:

1. **Friendship Preservation**: Bảo toàn mối quan hệ bạn bè sau khi unblock
2. **Bidirectional Block Check**: Kiểm tra block 2 chiều khi gửi friend request

## 🚀 New Features

### 1. Smart Friendship Preservation

**Trước khi cải tiến:**
- User1 block User2 → Friendship bị xóa vĩnh viễn
- User1 unblock User2 → Không phục hồi friendship, 2 user trở thành strangers

**Sau khi cải tiến:**
- User1 block User2 → Friendship được bảo toàn với metadata đặc biệt
- User1 unblock User2 → Tự động phục hồi friendship nếu trước đó là bạn bè

### 2. Bidirectional Block Protection

**Trước khi cải tiến:**
- Chỉ kiểm tra User1 → User2 block
- User2 vẫn có thể gửi request đến User1 (người đã block mình)

**Sau khi cải tiến:**
- Kiểm tra block 2 chiều: User1 → User2 VÀ User2 → User1
- Ngăn chặn hoàn toàn việc gửi friend request khi bị block

## 🔧 Technical Implementation

### Database Schema Changes

Thêm các trường mới vào `UserFriend` schema:

```typescript
// Block metadata
blockReason?: string;              // Lý do block (audit)
previousStatus?: string;           // Trạng thái trước khi block
wasAcceptedFriendship?: boolean;   // Có phải friendship trước đó?
blockedByTarget?: boolean;         // Bị block bởi target user?
targetBlockedAt?: Date;           // Thời điểm bị target block
```

### Enhanced Block Logic

```typescript
async blockUser(params) {
  const wasFriends = checkIfWereFriends();
  
  // Cập nhật friendship với metadata preservation
  updateFriendship(FriendStatus.BLOCKED, {
    wasAcceptedFriendship: wasFriends,
    previousStatus: friendship.status,
    blockReason: reason
  });
  
  // Preserve reverse friendship instead of deleting
  updateReverseFriendship(FriendStatus.BLOCKED, {
    blockedByTarget: true,
    wasAcceptedFriendship: wasFriends
  });
}
```

### Smart Unblock Logic

```typescript
async unblockUser(userId, friendId) {
  const wasFriends = checkWasAcceptedFriendship();
  
  if (wasFriends) {
    // Restore friendship on both sides
    restoreBothSidesToAccepted();
  } else {
    // Just remove block relationship
    deleteBlockRelationship();
  }
}
```

### Enhanced Friend Request Logic

```typescript
async sendFriendRequest(params) {
  // Check sender → receiver block
  if (existingFriendship?.status === BLOCKED) {
    throw new BadRequestException('Cannot send request to blocked user');
  }
  
  // Check receiver → sender block (NEW!)
  if (reverseFriendship?.status === BLOCKED) {
    throw new BadRequestException('Cannot send request - you are blocked by this user');
  }
}
```

## 📱 Mobile UX Impact

### Scenario 1: WhatsApp-like Block/Unblock
```
1. User1 và User2 đã kết bạn
2. User1 block User2 → Contact vẫn hiển thị nhưng không gửi được tin nhắn
3. User1 unblock User2 → Tự động trở lại bạn bè, có thể chat ngay lập tức
```

### Scenario 2: Security Protection
```
1. User1 block User2
2. User2 search User1 → Không thể gửi friend request
3. User2 thấy message: "You cannot send friend request to this user"
```

## 🛡️ Security Considerations

### Audit Trail
- `blockReason`: Lưu lý do block cho audit
- `blockedAt`, `targetBlockedAt`: Timestamp đầy đủ
- `previousStatus`: Theo dõi thay đổi trạng thái

### Privacy Protection
- User bị block không biết mình bị block
- Friend request rejection message generic
- Block status không expose trong public APIs

## 🔍 Testing Strategy

### Unit Tests
- [x] Block with existing friendship preservation
- [x] Block without existing friendship
- [x] Unblock with friendship restoration
- [x] Unblock without friendship restoration
- [x] Bidirectional block check in friend requests

### Integration Tests
- [x] Complete block → unblock → friend again flow
- [x] Block → friend request rejection flow
- [x] Multiple users blocking each other

## 📊 Performance Impact

### Database Operations
- **Block**: 2 updates instead of 1 update + 1 delete
- **Unblock**: 2 updates instead of 1 delete (for friendship restoration)
- **Friend Request**: Additional reverse friendship check

### Indexing Requirements
```javascript
// Existing indexes still optimal
{ userId: 1, friendId: 1 }
{ userId: 1, status: 1 }
{ friendId: 1, status: 1 }
```

## 🚧 Migration Considerations

### Existing Data
- Relationships với `status: 'blocked'` sẽ tiếp tục hoạt động
- Không cần migration cho data cũ
- New fields có default values

### Rollback Plan
- Schema changes backward compatible
- Logic fallback cho missing metadata fields

## 📝 API Documentation Updates

### Block User API
```typescript
POST /friends/block/:targetUserId
Body: { reason?: string }

// Response includes restoration info
{
  message: "User blocked successfully",
  willRestoreOnUnblock: boolean,
  blockedAt: string
}
```

### Unblock User API
```typescript
DELETE /friends/block/:targetUserId

// Response indicates if friendship was restored
{
  message: "User unblocked successfully",
  friendshipRestored: boolean
}
```

### Friend Status API
```typescript
GET /friends/status/:userId

// Enhanced response
{
  status: "FRIENDS" | "BLOCKED" | "PENDING_*" | "NONE",
  canSendMessage: boolean,
  canSendFriendRequest: boolean,
  friendshipDate?: string,
  wasRestoredFromBlock?: boolean
}
```

## ✅ Benefits Summary

1. **Better UX**: Friendship tự động phục hồi sau unblock
2. **Enhanced Security**: Block 2 chiều hoàn toàn
3. **Audit Trail**: Theo dõi đầy đủ block/unblock actions
4. **WhatsApp-like**: Behavior giống các ứng dụng chat phổ biến
5. **Mobile-Optimized**: Reduced friction cho mobile users

## 🎯 Next Steps

1. ✅ Implement enhanced logic
2. ✅ Update database schema
3. ✅ Add comprehensive tests
4. ⏳ Performance testing với large datasets
5. ⏳ Mobile app integration testing
6. ⏳ User acceptance testing
