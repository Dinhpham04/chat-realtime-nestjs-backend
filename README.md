<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

### Features

- 🔐 **Authentication & Authorization**: JWT-based auth with refresh tokens
- 💬 **Real-time Messaging**: Socket.IO integration for instant messaging
- 👥 **User Management**: User profiles, friends system, and contact management
- 📁 **File Management**: File upload, chunked upload, and file sharing
- 🎥 **Video Conversion**: Automatic conversion of mobile video formats for web preview
- 📞 **Voice/Video Calls**: WebRTC-based calling system
- 🌐 **Cross-platform**: API designed for mobile and web clients
- 📊 **Database**: MongoDB with Mongoose ODM
- 🚀 **Redis**: Caching and real-time presence management

#### Video Conversion Service
This application includes an intelligent video conversion service that automatically converts mobile video formats (`.mov`, `.avi`, `.3gp`, etc.) to MP4 for web browser compatibility. The conversion happens on-demand during file preview requests, ensuring optimal performance and storage efficiency.

## Project setup

```bash
$ npm install
```

### FFmpeg Installation (Required for Video Conversion)

This project includes a video conversion service that automatically converts mobile video formats (.mov, .avi, .3gp, etc.) to MP4 for web preview compatibility. FFmpeg will be automatically detected after installation.

#### Windows (Recommended)
```bash
# Install FFmpeg using Windows Package Manager (easiest method)
winget install Gyan.FFmpeg.Essentials

# Verify installation
ffmpeg -version
```

#### macOS
```bash
# Install FFmpeg using Homebrew
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

#### Auto-Detection
The service automatically detects FFmpeg in:
- ✅ System PATH
- ✅ WinGet installations (Windows)
- ✅ Homebrew installations (macOS)
- ✅ Common installation directories
- ✅ Manual configurations via `.env`

#### Manual Configuration (Optional)
Only needed if auto-detection fails:

```env
# .env file - Only if auto-detection doesn't work
FFMPEG_PATH=/path/to/ffmpeg
FFPROBE_PATH=/path/to/ffprobe
```

**Note**: After installing FFmpeg, restart the application to enable video conversion features.

## API Documentation

Once the application is running, you can access the Swagger API documentation at:
- Local: `http://localhost:3000/api/v1/docs`
- Network: `http://YOUR_LOCAL_IP:3000/api/v1/docs`

### Key API Endpoints

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh-token` - Refresh access token

#### File Management & Video Conversion
- `POST /api/v1/files/upload` - Upload files (including videos)
- `GET /api/v1/files/preview/:fileId` - Preview files (auto-converts videos)
- `GET /api/v1/files/download/:fileId` - Download original files

#### Real-time Messaging
- `POST /api/v1/messages` - Send message
- `GET /api/v1/messages/conversation/:id` - Get conversation messages
- Socket.IO events for real-time communication

#### Voice/Video Calls
- `POST /api/v1/calls/initiate` - Start a call
- `PATCH /api/v1/calls/:id/accept` - Accept call
- WebRTC signaling through Socket.IO

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

$ npm run test:cov
```

## Troubleshooting

### FFmpeg Issues

The enhanced auto-detection system should find FFmpeg automatically. If you encounter issues:

1. **Verify FFmpeg Installation**:
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

2. **Check Auto-Detection Logs**:
   Look for these success messages in application logs:
   ```
   ✅ FFmpeg found in PATH: /path/to/ffmpeg
   ✅ FFprobe found in PATH: /path/to/ffprobe
   ```

   Or these detection messages:
   ```
   ✅ FFmpeg found via WinGet: /winget/path/to/ffmpeg.exe
   ✅ FFmpeg found at: /custom/path/to/ffmpeg
   ```

3. **Manual Override (Last Resort)**:
   Only if auto-detection completely fails:
   ```env
   # .env file
   FFMPEG_PATH=/full/path/to/ffmpeg
   FFPROBE_PATH=/full/path/to/ffprobe
   ```

4. **Restart Application**:
   After installing FFmpeg, restart the NestJS application.

**Supported Installation Methods**:
- ✅ WinGet (Windows) - Automatically detected
- ✅ Homebrew (macOS) - Automatically detected  
- ✅ APT (Ubuntu/Debian) - Automatically detected
- ✅ Manual installations in common directories
- ✅ System PATH installations

### Common Issues

- **Port 3000 already in use**: Change the port in your environment or kill the existing process
- **MongoDB connection issues**: Ensure MongoDB is running and connection string is correct
- **Redis connection issues**: Ensure Redis server is running for real-time features

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
