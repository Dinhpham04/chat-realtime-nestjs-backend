# 🧪 Testing Guide for Conversations APIs

## **1. Manual Testing với Postman/Insomnia**

### **Setup Environment**
```bash
# Base URL
BASE_URL=http://localhost:3000/api/v1

# Authentication Headers
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### **Test Case 1: Prepare New Conversation** ✅
```http
POST {{BASE_URL}}/conversations/prepare
Authorization: Bearer {{jwt_token}}

{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d1"
}

Expected: 
- Status: 201 Created
- Response.exists: false
- Response.isActive: false
- Response.conversationId: new ID
```

### **Test Case 2: Prepare Existing Conversation** ✅
```http
POST {{BASE_URL}}/conversations/prepare
Authorization: Bearer {{jwt_token}}

{
  "participantId": "64f1a2b3c4d5e6f7a8b9c0d1"
}

Expected:
- Status: 200 OK  
- Response.exists: true
- Response.isActive: true (if previously activated)
- Response.conversationId: existing ID
```

### **Test Case 3: Activate Conversation** ✅
```http
POST {{BASE_URL}}/conversations/activate
Authorization: Bearer {{jwt_token}}

{
  "conversationId": "64f2b3c4d5e6f7a8b9c0d2e3",
  "initialMessage": {
    "content": {
      "text": "Hello! This is my first message 👋",
      "mentions": []
    },
    "messageType": "text"
  }
}

Expected:
- Status: 201 Created
- Response.created: true
- Response.conversation.isActive: true
- Response.message: created message object
```

---

## **2. Integration Tests**

### **Test Database Setup**
```bash
# Start MongoDB for testing
docker run -d --name mongo-test -p 27018:27017 mongo:5.0

# Environment variables for testing
TEST_MONGODB_URI=mongodb://localhost:27018/test_chat_app
```

### **Sample Integration Test**
```typescript
describe('Conversations API Integration', () => {
  let app: INestApplication;
  let jwtToken: string;
  
  beforeAll(async () => {
    // Setup test app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
    
    // Login to get JWT token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    
    jwtToken = loginResponse.body.accessToken;
  });
  
  it('should prepare and activate conversation flow', async () => {
    // Step 1: Prepare conversation
    const prepareResponse = await request(app.getHttpServer())
      .post('/api/v1/conversations/prepare')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ participantId: 'target_user_id' })
      .expect(201);
    
    expect(prepareResponse.body.exists).toBe(false);
    expect(prepareResponse.body.isActive).toBe(false);
    
    // Step 2: Activate conversation
    const activateResponse = await request(app.getHttpServer())
      .post('/api/v1/conversations/activate')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        conversationId: prepareResponse.body.conversationId,
        initialMessage: {
          content: { text: 'Hello there!', mentions: [] },
          messageType: 'text'
        }
      })
      .expect(201);
    
    expect(activateResponse.body.created).toBe(true);
    expect(activateResponse.body.conversation.isActive).toBe(true);
  });
});
```

---

## **3. Performance Testing**

### **Load Test với Artillery**
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      
scenarios:
  - name: 'Prepare Conversation'
    weight: 70
    flow:
      - post:
          url: '/api/v1/conversations/prepare'
          headers:
            Authorization: 'Bearer {{token}}'
          json:
            participantId: '{{participantId}}'
            
  - name: 'Activate Conversation'  
    weight: 30
    flow:
      - post:
          url: '/api/v1/conversations/activate'
          headers:
            Authorization: 'Bearer {{token}}'
          json:
            conversationId: '{{conversationId}}'
            initialMessage:
              content:
                text: 'Performance test message'
              messageType: 'text'
```

### **Run Load Test**
```bash
# Install Artillery
npm install -g artillery

# Run test
artillery run artillery-config.yml
```

---

## **4. Error Scenarios Testing**

### **Test Invalid Inputs** ❌
```bash
# Missing participantId
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Invalid ObjectId format
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "invalid-id"}'
```

### **Test Authentication** 🔐
```bash
# No token
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Content-Type: application/json" \
  -d '{"participantId": "64f1a2b3c4d5e6f7a8b9c0d1"}'

# Invalid token
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "64f1a2b3c4d5e6f7a8b9c0d1"}'
```

### **Test Business Logic Errors** 🚫
```bash
# Try to message yourself
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "current-user-id"}'

# User not found
curl -X POST http://localhost:3000/api/v1/conversations/prepare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "64f1a2b3c4d5e6f7a8b9c0d1"}'
```

---

## **5. Database Testing**

### **MongoDB Queries Performance**
```javascript
// Test trong MongoDB Shell

// Index performance test
db.conversations.explain("executionStats").find({
  "participants": { $all: [
    ObjectId("64f0a1b2c3d4e5f6a7b8c9d0"),
    ObjectId("64f1a2b3c4d5e6f7a8b9c0d1")
  ]},
  "type": "direct"
})

// Check if indexes are being used
db.conversations.getIndexes()
db.conversation_participants.getIndexes()
```

### **Data Consistency Tests**
```javascript
// Test referential integrity
const conversation = db.conversations.findOne({_id: ObjectId("...")});
const participants = db.conversation_participants.find({
  conversationId: conversation._id
}).toArray();

// Should have exactly 2 participants for direct conversation
assert(participants.length === 2);
```

---

## **6. WebSocket Testing (cho real-time features)**

### **Socket.io Testing**
```javascript
const io = require('socket.io-client');

describe('Conversation WebSocket', () => {
  let clientSocket;
  
  beforeAll((done) => {
    clientSocket = io('http://localhost:3000', {
      auth: { token: 'jwt-token' }
    });
    clientSocket.on('connect', done);
  });
  
  afterAll(() => {
    clientSocket.close();
  });
  
  test('should receive conversation updates', (done) => {
    clientSocket.on('conversation-activated', (data) => {
      expect(data.conversationId).toBeDefined();
      expect(data.isActive).toBe(true);
      done();
    });
    
    // Trigger conversation activation
    // API call here...
  });
});
```

---

## **7. Testing Checklist** ✅

### **Functional Tests**
- [ ] Prepare conversation creates new conversation
- [ ] Prepare conversation returns existing conversation  
- [ ] Activate conversation creates first message
- [ ] Activate conversation updates isActive status
- [ ] User cannot message themselves
- [ ] User cannot message non-existent user
- [ ] Non-participants cannot activate conversation

### **Security Tests** 
- [ ] JWT authentication required
- [ ] User can only access their own conversations
- [ ] Input validation prevents injection attacks
- [ ] Rate limiting prevents abuse

### **Performance Tests**
- [ ] Prepare API responds under 200ms
- [ ] Activate API responds under 500ms  
- [ ] Database queries use proper indexes
- [ ] Memory usage stays within limits

### **Edge Cases**
- [ ] Handle duplicate requests gracefully
- [ ] Large message content (max size limits)
- [ ] Multiple attachments handling
- [ ] Concurrent conversation creation

---

## **8. Automated Testing Script**

```bash
#!/bin/bash
# test-conversations-api.sh

BASE_URL="http://localhost:3000/api/v1"
TOKEN="your-jwt-token"

echo "🧪 Testing Conversations API..."

# Test 1: Prepare conversation
echo "Test 1: Prepare Conversation"
PREPARE_RESPONSE=$(curl -s -X POST "$BASE_URL/conversations/prepare" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"participantId": "64f1a2b3c4d5e6f7a8b9c0d1"}')

CONVERSATION_ID=$(echo $PREPARE_RESPONSE | jq -r '.conversationId')
echo "✅ Conversation ID: $CONVERSATION_ID"

# Test 2: Activate conversation  
echo "Test 2: Activate Conversation"
ACTIVATE_RESPONSE=$(curl -s -X POST "$BASE_URL/conversations/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"conversationId\": \"$CONVERSATION_ID\",
    \"initialMessage\": {
      \"content\": {\"text\": \"Test message from script\", \"mentions\": []},
      \"messageType\": \"text\"
    }
  }")

echo "✅ Message created"
echo $ACTIVATE_RESPONSE | jq '.'

echo "🎉 All tests completed!"
```

**Run the test:**
```bash
chmod +x test-conversations-api.sh
./test-conversations-api.sh
```

Đây là hướng dẫn testing hoàn chỉnh cho 2 APIs prepare và activate conversation! 🚀
