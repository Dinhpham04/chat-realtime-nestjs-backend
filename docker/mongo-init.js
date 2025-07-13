db = db.getSiblingDB('messaging-app');
db.createUser({
    user: 'app',
    pwd: 'app123',
    roles: [
        {
            role: 'readWrite',
            db: 'messaging-app',
        },
    ],
});

// Tạo collections với indexes
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });

db.createCollection('conversations');
db.conversations.createIndex({ members: 1 });
db.conversations.createIndex({ type: 1 });

db.createCollection('messages');
db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1 });

db.createCollection('friend_requests');
db.friend_requests.createIndex({ from: 1, to: 1 }, { unique: true });
db.friend_requests.createIndex({ to: 1, status: 1 });

console.log('Database initialized successfully!');
