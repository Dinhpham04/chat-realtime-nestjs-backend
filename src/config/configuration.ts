import { getServerHost, getCorsOrigins } from '../shared/utils/network/network-utils';

export default () => ({
  port: Number(process.env.PORT) || 3000,
  host: getServerHost(), // Dynamic host based on environment
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  database: {
    uri: process.env.MONGODB_URI || `mongodb://localhost:27017/messaging-app`,
    user: process.env.MONGODB_USER || 'admin',
    password: process.env.MONGODB_PASSWORD || 'admin123',
    authSource: process.env.MONGODB_AUTH_SOURCE || 'admin',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
    ],
  },

  // Enhanced CORS configuration for local development
  cors: {
    origin: getCorsOrigins(), // Dynamic CORS origins including local network
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },

  // Network configuration for voice/video calls
  network: {
    localDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
    enableNetworkLogging: process.env.ENABLE_NETWORK_LOGGING === 'true',
  },
});
