# 💬 Real-time Chat Backend - NestJS

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">Enterprise-grade real-time messaging backend built with NestJS, featuring comprehensive chat functionality, file sharing, voice/video calls, and Socket.IO integration.</p>

<p align="center">
  <a href="https://nestjs.com/" target="_blank"><img src="https://img.shields.io/badge/Built%20with-NestJS-red.svg" alt="Built with NestJS" /></a>
  <a href="https://nodejs.org/" target="_blank"><img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js 18+" /></a>
  <a href="https://www.mongodb.com/" target="_blank"><img src="https://img.shields.io/badge/Database-MongoDB-green.svg" alt="MongoDB" /></a>
  <a href="https://redis.io/" target="_blank"><img src="https://img.shields.io/badge/Cache-Redis-red.svg" alt="Redis" /></a>
  <a href="https://socket.io/" target="_blank"><img src="https://img.shields.io/badge/Real--time-Socket.IO-black.svg" alt="Socket.IO" /></a>
  <a href="https://swagger.io/" target="_blank"><img src="https://img.shields.io/badge/API-Swagger-brightgreen.svg" alt="Swagger API" /></a>
</p>

## 📋 Description

Full-featured real-time messaging backend inspired by Zalo and Messenger, designed with enterprise-grade architecture and mobile-first approach. Built with NestJS framework following Clean Architecture principles.</p>

## ✨ Core Features

### 🔐 Authentication & Security
- **JWT Authentication**: Access tokens with refresh token rotation
- **Device Management**: Multi-device login support with session tracking
- **Rate Limiting**: Request throttling and abuse prevention
- **Phone Number Auth**: OTP-based registration and login system

### 💬 Real-time Messaging
- **Socket.IO Integration**: Instant message delivery with fallback support
- **Message Types**: Text, voice notes, images, videos, documents, and files
- **Message Status**: Sent, delivered, read receipts with real-time updates
- **Message Search**: Full-text search with filters (type, sender, date range)
- **Message Threading**: Reply, forward, and quote message functionality
- **Bulk Operations**: Delete, mark as read for multiple messages

### 👥 Social Features
- **Friends System**: Add, remove, block friends with status management
- **Contact Sync**: Phone contact discovery and friend suggestions
- **Online Presence**: Multi-device online status with heartbeat system
- **User Profiles**: Customizable profiles with avatar and status messages
- **Privacy Controls**: Block users, message filtering

### � Advanced File Management
- **Smart Upload**: Chunked upload for large files with resume capability
- **File Processing**: Automatic thumbnail generation for images
- **Video Conversion**: Mobile video format conversion (MOV, AVI → MP4)
- **File Deduplication**: Intelligent storage optimization
- **Secure Downloads**: Token-based download URLs with expiration
- **Rich Media Support**: 50+ file types including documents, archives, media

### 📞 Voice & Video Calls
- **WebRTC Integration**: Peer-to-peer voice and video calling
- **Call Management**: Initiate, accept, reject, end calls
- **Call History**: Track call duration and status
- **Multi-device Notifications**: Ring on all user devices

### 🏗️ Enterprise Architecture
- **Clean Architecture**: Repository pattern with dependency injection
- **Modular Design**: Feature-based module organization
- **Database**: MongoDB with Mongoose ODM for scalability
- **Caching**: Redis for session management and real-time state
- **API Documentation**: Complete Swagger/OpenAPI documentation
- **Testing**: Unit tests with Jest framework
- **Docker Support**: Containerized development environment

## 🏗️ Project Architecture

### Module Structure
```
src/
├── modules/                    # Feature modules
│   ├── auth/                  # Authentication & authorization
│   │   ├── controllers/       # Auth endpoints (login, register, refresh)
│   │   ├── services/          # Auth business logic & token management
│   │   ├── guards/           # JWT guards & device validation
│   │   └── strategies/       # Passport strategies
│   ├── users/                # User management
│   │   ├── controllers/       # User CRUD operations
│   │   ├── services/         # User business logic
│   │   └── schemas/          # User data models
│   ├── friends/              # Social connections
│   │   ├── services/         # Friend requests, contact sync
│   │   └── repositories/     # Friend relationship data access
│   ├── conversations/        # Chat conversations
│   │   ├── controllers/       # Conversation management
│   │   ├── services/         # Group chat, direct messages
│   │   └── schemas/          # Conversation models
│   ├── messages/             # Messaging system
│   │   ├── controllers/       # Send, edit, delete messages
│   │   ├── services/         # Message processing & search
│   │   └── repositories/     # Message data access
│   ├── files/               # File management
│   │   ├── controllers/      # Upload, download, processing
│   │   ├── services/        # File validation, storage, conversion
│   │   └── schemas/         # File metadata models
│   └── calls/               # Voice/Video calling
│       ├── controllers/      # Call management
│       ├── services/        # WebRTC signaling
│       └── schemas/         # Call history models
├── socket/                   # Real-time communication
│   ├── gateways/            # Socket.IO event handlers
│   ├── services/           # Message queue, device sync
│   └── controllers/        # Socket management
├── shared/                  # Shared utilities
│   ├── services/           # Presence, last message tracking
│   ├── guards/            # Authentication guards
│   ├── filters/           # Exception handling
│   ├── interceptors/      # Request/response transformation
│   └── utils/             # Helper functions
├── redis/                   # Redis integration
│   ├── services/           # Cache management, real-time state
│   └── modules/            # Redis module configuration
├── database/                # Database configuration
└── config/                  # App configuration
```

### Technology Stack
- **Framework**: NestJS (Node.js)
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for sessions and real-time state
- **Real-time**: Socket.IO for WebSocket communication
- **Authentication**: JWT with refresh tokens
- **File Storage**: Local storage with cloud support
- **Video Processing**: FFmpeg for media conversion
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest unit testing framework

## 🚀 Quick Start

### 1. Prerequisites

**Required Software:**
- Node.js 18+ LTS
- MongoDB 7.0+
- Redis 7.0+
- FFmpeg (for video conversion)

### 2. Installation

**Clone and Install Dependencies:**
```bash
# Clone repository
git clone <repository-url>
cd chat-realtime-nestjs-backend

# Install dependencies
npm install
```

**Setup Environment:**
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Environment Variables:**
```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
MONGODB_URI=mongodb://admin:admin123@localhost:27017/messaging-app

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Security
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
ACCESS_TOKEN_EXPIRE=15m
REFRESH_TOKEN_EXPIRE=7d

# File Upload
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads

# Optional: FFmpeg paths (auto-detected)
FFMPEG_PATH=/path/to/ffmpeg
FFPROBE_PATH=/path/to/ffprobe
```

### 3. Database Setup

**Option A: Docker (Recommended)**
```bash
# Start MongoDB and Redis services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

**Option B: Local Installation**
```bash
# MongoDB (Ubuntu/Debian)
sudo apt update && sudo apt install mongodb

# MongoDB (macOS)
brew install mongodb-community

# Redis (Ubuntu/Debian)
sudo apt install redis-server

# Redis (macOS)
brew install redis
```

### 4. Start Development Server

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

**Server will start at:**
- API: `http://localhost:3000/api/v1`
- Swagger Docs: `http://localhost:3000/api/v1/docs`
- Socket.IO: `ws://localhost:3000/chat`

## 🎬 FFmpeg Setup for Video Conversion

This application features intelligent video conversion that automatically converts mobile video formats (`.mov`, `.avi`, `.3gp`, etc.) to MP4 for web browser compatibility.

### Installation Methods

#### Windows (Recommended)
```bash
# Using Windows Package Manager (easiest)
winget install Gyan.FFmpeg.Essentials

# Or download from: https://www.gyan.dev/ffmpeg/builds/
# Extract to C:\ffmpeg and add to PATH
```

#### macOS
```bash
# Using Homebrew
brew install ffmpeg

# Verify installation
ffmpeg -version
```

#### Ubuntu/Debian
```bash
# Install FFmpeg
sudo apt update && sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

### Auto-Detection Features
The service automatically detects FFmpeg in:
- ✅ System PATH
- ✅ WinGet installations (Windows)
- ✅ Homebrew installations (macOS)
- ✅ Common installation directories
- ✅ Manual configurations via `.env`

### Manual Configuration (Optional)
Only needed if auto-detection fails:
```env
# .env file
FFMPEG_PATH=/path/to/ffmpeg
FFPROBE_PATH=/path/to/ffprobe
```

**Note**: Restart the application after installing FFmpeg to enable video conversion features.

## 📚 API Documentation

### Interactive Documentation
Once the application is running, access comprehensive API documentation:
- **Local**: `http://localhost:3000/api/v1/docs`
- **Network**: `http://YOUR_LOCAL_IP:3000/api/v1/docs`

### Key API Endpoints

#### 🔐 Authentication
- `POST /api/v1/auth/register` - User registration with phone verification
- `POST /api/v1/auth/login` - User login with credentials
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `GET /api/v1/auth/profile` - Get current user profile
- `POST /api/v1/auth/logout` - Logout and invalidate tokens

#### 👥 Users & Friends
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `POST /api/v1/friends/add` - Send friend request
- `GET /api/v1/friends/list` - Get friends list with online status
- `POST /api/v1/friends/accept/:requestId` - Accept friend request
- `DELETE /api/v1/friends/remove/:friendId` - Remove friend

#### 💬 Conversations & Messages
- `GET /api/v1/conversations` - Get user conversations
- `POST /api/v1/conversations` - Create new conversation
- `GET /api/v1/messages/conversation/:id` - Get conversation messages
- `POST /api/v1/messages` - Send message
- `GET /api/v1/messages/conversation/:id/search` - Search messages
- `GET /api/v1/messages/conversation/:id/around/:messageId` - Get message context

#### 📁 File Management
- `POST /api/v1/files/upload` - Upload files with chunked support
- `GET /api/v1/files/preview/:fileId` - Preview files (auto-converts videos)
- `GET /api/v1/files/download/:fileId` - Download original files
- `POST /api/v1/files/chunk/init` - Initialize chunked upload
- `POST /api/v1/files/chunk/upload` - Upload file chunk
- `POST /api/v1/files/chunk/complete` - Complete chunked upload

#### 📞 Voice & Video Calls
- `POST /api/v1/calls/initiate` - Start a voice/video call
- `PATCH /api/v1/calls/:id/accept` - Accept incoming call
- `PATCH /api/v1/calls/:id/reject` - Reject incoming call
- `PATCH /api/v1/calls/:id/end` - End active call
- `GET /api/v1/calls/history` - Get call history

### Testing

**Unit Tests:**
```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- auth.service.spec.ts

# Run tests with coverage
npm run test:cov
```

**E2E Tests:**
```bash
# Run end-to-end tests
npm run test:e2e
```

**Manual Testing:**
- Use the Swagger UI at `/api/v1/docs`
- Test Socket.IO with `socket-test.html`
- Use Postman collection (if available)

### Development Guidelines

**Code Style:**
- Follow NestJS conventions
- Use TypeScript strict mode
- Implement proper error handling
- Add comprehensive JSDoc comments
- Write unit tests for services

**Architecture Principles:**
- Clean Architecture with dependency injection
- Repository pattern for data access
- Service layer for business logic
- Controller layer for HTTP handling
- DTOs for request/response validation

**Git Workflow:**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

## 🐛 Troubleshooting

### Common Issues

#### FFmpeg Video Conversion
```bash
# Check FFmpeg installation
ffmpeg -version
ffprobe -version

# Look for auto-detection in logs
✅ FFmpeg found in PATH: /path/to/ffmpeg
✅ FFprobe found in PATH: /path/to/ffprobe

# Manual override if needed
FFMPEG_PATH=/full/path/to/ffmpeg
FFPROBE_PATH=/full/path/to/ffprobe
```

#### Database Connection
```bash
# MongoDB connection issues
MongoDB URI: mongodb://admin:admin123@localhost:27017/messaging-app

# Check MongoDB status
sudo systemctl status mongod

# Check Docker containers
docker ps
```

#### Redis Connection
```bash
# Redis connection issues
redis-cli ping

# Check Redis configuration
redis-cli config get "*"
```

#### Port Conflicts
```bash
# Port 3000 already in use
netstat -tulpn | grep 3000
kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### Socket.IO Issues
```bash
# Test Socket.IO connection
# Open socket-test.html in browser
# Check browser developer console for connection errors
```

### Performance Optimization

#### Redis Caching
- Enable Redis for session storage
- Cache frequently accessed data
- Use Redis for real-time presence

#### Database Optimization
- Create indexes for frequently queried fields
- Use aggregation pipelines for complex queries
- Implement pagination for large datasets

#### File Upload Optimization
- Use chunked upload for large files
- Implement file deduplication
- Configure appropriate file size limits

### Monitoring & Logging

#### Application Logs
```bash
# View application logs
npm run start:dev

# Docker logs
npm run docker:logs
```

#### Health Checks
- **API Health**: `GET /api/v1/auth/health`
- **Database**: Check MongoDB connection
- **Redis**: Check Redis connection
- **Socket.IO**: Test real-time connectivity

## 🚀 Deployment

### Environment Setup

**Production Environment Variables:**
```env
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Secure database connections
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/messaging-app
REDIS_URL=redis://username:password@redis-host:6379

# Strong JWT secrets
JWT_SECRET=your_very_secure_jwt_secret_key_here
JWT_REFRESH_SECRET=your_very_secure_refresh_secret_key_here

# File storage (consider cloud storage)
UPLOAD_PATH=/var/app/uploads
MAX_FILE_SIZE=100MB

# Optional: Cloud storage
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_BUCKET_NAME=your_s3_bucket
```

### Docker Deployment

**Production Docker Compose:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./uploads:/app/uploads

  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secure_password
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  mongodb_data:
  redis_data:
```

### Cloud Deployment Options

#### AWS Deployment
- **EC2**: Deploy with PM2 process manager
- **ECS**: Containerized deployment
- **Elastic Beanstalk**: Easy deployment with load balancing

#### Heroku Deployment
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret

# Deploy
git push heroku main
```

#### DigitalOcean App Platform
```yaml
# app.yaml
name: chat-backend
services:
- name: api
  source_dir: /
  github:
    repo: your-username/chat-realtime-nestjs-backend
    branch: main
  run_command: npm run start:prod
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
```

### Performance Considerations

#### Production Optimizations
- Enable compression middleware
- Configure proper CORS settings
- Use CDN for static files
- Implement rate limiting
- Set up monitoring and alerting

#### Scaling Strategies
- **Horizontal Scaling**: Multiple app instances behind load balancer
- **Database Scaling**: MongoDB replica sets or sharding
- **Redis Clustering**: Redis cluster for high availability
- **CDN Integration**: CloudFront or similar for file delivery

## 📖 Documentation

### Available Documentation
- **API Documentation**: `/docs/api-docs/` - Complete API reference
- **Architecture Guide**: `/docs/Architecture/` - System design documents
- **Implementation Summaries**: `/docs/implementation-summary/` - Feature guides
- **Development Plans**: `/docs/plans/` - Project roadmaps

### Key Documents
- [Message Search & Navigation API](./docs/api-docs/messages-search-navigation-api.md)
- [Online Presence System](./docs/implementation-summary/presence-system-implementation.md)
- [File Management Guide](./docs/implementation-summary/files-implementation-summary.md)
- [Socket.IO Events Reference](./docs/Api/10-socket-events-quick-reference.md)

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Setup for Contributors
```bash
# Fork and clone
git clone https://github.com/your-username/chat-realtime-nestjs-backend.git
cd chat-realtime-nestjs-backend

# Install dependencies
npm install

# Setup development environment
cp .env.example .env
npm run docker:up

# Start development server
npm run start:dev

# Run tests
npm run test
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NestJS Team** - For the amazing framework
- **Socket.IO Team** - For real-time communication capabilities
- **MongoDB Team** - For the robust database solution
- **Redis Team** - For the high-performance caching solution
- **FFmpeg Team** - For video processing capabilities

---

<p align="center">
  <strong>Built with ❤️ using NestJS</strong><br>
  <a href="https://nestjs.com/">Learn more about NestJS</a>
</p>
