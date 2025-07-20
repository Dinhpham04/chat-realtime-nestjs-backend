# Block/Unblock Logic Test Cases

## Test Scenario 1: Friendship Preservation After Block/Unblock

### Initial State
- User1 and User2 are friends (ACCEPTED status on both sides)

### Test Case 1.1: Block then Unblock with Friendship Restoration
```
1. User1 blocks User2
   Expected:
   - User1 → User2: BLOCKED (with wasAcceptedFriendship: true)
   - User2 → User1: BLOCKED (with blockedByTarget: true, wasAcceptedFriendship: true)

2. User1 unblocks User2
   Expected:
   - User1 → User2: ACCEPTED (restored)
   - User2 → User1: ACCEPTED (restored)
   - Both users are friends again
```

### Test Case 1.2: Block without Previous Friendship
```
1. User1 blocks User3 (never been friends)
   Expected:
   - User1 → User3: BLOCKED (no wasAcceptedFriendship flag)
   - No reverse relationship created

2. User1 unblocks User3
   Expected:
   - Block relationship deleted
   - No friendship created
   - Users are strangers again
```

## Test Scenario 2: Friend Request Blocking Logic

### Test Case 2.1: Send Request to User Who Blocked You
```
1. User2 blocks User1
2. User1 tries to send friend request to User2
   Expected: BadRequestException "Cannot send request - you are blocked by this user"
```

### Test Case 2.2: Send Request to User You Blocked
```
1. User1 blocks User2
2. User1 tries to send friend request to User2
   Expected: BadRequestException "Cannot send request to blocked user"
```

### Test Case 2.3: Normal Friend Request After Unblock
```
1. User1 blocks User2
2. User1 unblocks User2
3. User1 sends friend request to User2
   Expected: SUCCESS - friend request sent normally
```

## API Testing Commands

### Setup Friends Relationship
```bash
# Send friend request from User1 to User2
POST /friends/requests
{
  "receiverId": "user2_id",
  "message": "Let's be friends!"
}

# Accept friend request
PUT /friends/requests/{requestId}/respond
{
  "action": "ACCEPT"
}

# Verify friendship
GET /friends/status/user2_id
# Should return: { "status": "FRIENDS" }
```

### Test Block/Unblock
```bash
# Block user
POST /friends/block/user2_id
{
  "reason": "Test blocking"
}

# Check status after block
GET /friends/status/user2_id
# Should return: { "status": "BLOCKED" }

# Unblock user
DELETE /friends/block/user2_id

# Check status after unblock
GET /friends/status/user2_id
# Should return: { "status": "FRIENDS" } (restored friendship)
```

### Test Blocked Friend Request
```bash
# User2 tries to send request to User1 (who blocked User2)
POST /friends/requests
{
  "receiverId": "user1_id",
  "message": "Please be my friend"
}
# Should return: 400 "Cannot send request - you are blocked by this user"
```

## Expected Database State

### After Block (with previous friendship)
```javascript
// User1 → User2
{
  userId: "user1_id",
  friendId: "user2_id",
  status: "blocked",
  wasAcceptedFriendship: true,
  blockedAt: "2025-07-19T...",
  blockReason: "Test blocking",
  previousStatus: "accepted"
}

// User2 → User1
{
  userId: "user2_id",
  friendId: "user1_id",
  status: "blocked",
  wasAcceptedFriendship: true,
  blockedByTarget: true,
  targetBlockedAt: "2025-07-19T...",
  previousStatus: "accepted"
}
```

### After Unblock (friendship restored)
```javascript
// User1 → User2
{
  userId: "user1_id",
  friendId: "user2_id",
  status: "accepted",
  acceptedAt: "2025-07-19T...", // New timestamp
  // Block fields cleared
  blockedAt: null,
  blockReason: null,
  wasAcceptedFriendship: null,
  previousStatus: null
}

// User2 → User1
{
  userId: "user2_id",
  friendId: "user1_id",
  status: "accepted",
  acceptedAt: "2025-07-19T...", // New timestamp
  // Block fields cleared
  blockedByTarget: null,
  targetBlockedAt: null,
  wasAcceptedFriendship: null,
  previousStatus: null
}
```
