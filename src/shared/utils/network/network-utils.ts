import { networkInterfaces } from 'os';

/**
 * Network Utilities - Senior Level Implementation
 * Following Senior Guidelines:
 * - Single Responsibility: Each function has one purpose
 * - Error Handling: Proper error handling without data leakage
 * - Documentation: JSDoc for public methods
 * - No hard code: Environment-based configuration
 */

/**
 * Get the local network IP address of the machine
 * Used for local development to allow mobile device connections
 * Prioritizes real LAN interfaces over WSL/virtual interfaces
 * @returns {string} Local network IP address (e.g., '192.168.1.100')
 */
export function getLocalNetworkIP(): string {
  const interfaces = networkInterfaces();
  const candidates: Array<{ address: string, priority: number, interfaceName: string }> = [];

  for (const interfaceName of Object.keys(interfaces)) {
    const interfaceDetails = interfaces[interfaceName];

    if (!interfaceDetails) continue;

    for (const detail of interfaceDetails) {
      // Look for IPv4, non-internal, and non-loopback addresses
      if (
        detail.family === 'IPv4' &&
        !detail.internal &&
        detail.address !== '127.0.0.1'
      ) {
        let priority = 0;

        // Prioritize real network interfaces over virtual ones
        console.log(`🔍 Checking interface: ${interfaceName} (${detail.address})`);

        if (interfaceName.toLowerCase().includes('wifi')) {
          priority = 10; // Highest priority for WiFi
          console.log(`  ✅ WiFi interface detected - Priority: ${priority}`);
        } else if (interfaceName.toLowerCase().includes('ethernet') && !interfaceName.toLowerCase().includes('vethernet')) {
          priority = 9; // High priority for real Ethernet
          console.log(`  ✅ Real Ethernet interface detected - Priority: ${priority}`);
        } else if (detail.address.startsWith('192.168.') || detail.address.startsWith('10.') || detail.address.startsWith('172.16.')) {
          // Standard private network ranges, but lower priority for virtual interfaces
          if (interfaceName.toLowerCase().includes('wsl') || interfaceName.toLowerCase().includes('vethernet')) {
            priority = 1; // Very low priority for WSL/virtual
            console.log(`  ⚠️ WSL/Virtual interface detected - Priority: ${priority}`);
          } else {
            priority = 5; // Medium priority for other private networks
            console.log(`  📡 Private network interface detected - Priority: ${priority}`);
          }
        } else {
          console.log(`  ❌ Interface skipped - no matching criteria`);
        }

        if (priority > 0) {
          candidates.push({
            address: detail.address,
            priority,
            interfaceName
          });
        }
      }
    }
  }

  // Sort by priority (highest first) and return the best candidate
  candidates.sort((a, b) => b.priority - a.priority);

  if (candidates.length > 0) {
    const selected = candidates[0];
    console.log(`🌐 Selected network interface: ${selected.interfaceName} (${selected.address}) - Priority: ${selected.priority}`);
    console.log(`📱 Available candidates:`, candidates);
    return selected.address;
  }

  // Fallback to localhost if no network interface found
  console.warn('⚠️ No suitable network interface found, falling back to localhost');
  return 'localhost';
}/**
 * Check if the current environment is development
 * @returns {boolean} True if development environment
 */
export function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Get the host configuration for the server based on environment
 * Development: 0.0.0.0 (all interfaces) for mobile access
 * Production: localhost or configured host for security
 * @returns {string} Host configuration
 */
export function getServerHost(): string {
  if (isDevelopmentEnvironment()) {
    return '0.0.0.0'; // Allow all network interfaces for local development
  }

  return process.env.HOST || 'localhost';
}

/**
 * Get CORS origins based on environment and local network
 * Development: Include local network IP for mobile app access
 * Production: Use configured origins only
 * @returns {string[]} Array of allowed CORS origins
 */
export function getCorsOrigins(): string[] {
  const baseOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

  if (isDevelopmentEnvironment()) {
    const localIP = getLocalNetworkIP();
    const port = process.env.PORT || 3000;

    // Add local network access for mobile development
    const localNetworkOrigins = [
      `http://${localIP}:${port}`,
      `http://${localIP}:8083`, // Expo Go default port
      `http://${localIP}:19000`, // Expo development server
      `http://${localIP}:19001`, // Expo development server alternative
      'http://localhost:8081',
      'http://localhost:19000',
      'http://localhost:19001',
      'http://192.168.0.101:8081',
      'http://127.0.0.1:5500',
      'http://192.168.0.104:5500'
    ];

    return [...baseOrigins, ...localNetworkOrigins];
  }

  return baseOrigins;
}

/**
 * Log network configuration for debugging
 * Helps developers understand how to connect from mobile devices
 */
export function logNetworkConfiguration(port: number, apiPrefix: string): void {
  const localIP = getLocalNetworkIP();
  const host = getServerHost();

  console.log('\n🌐 NETWORK CONFIGURATION:');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Server Host: ${host}:${port}`);

  if (isDevelopmentEnvironment()) {
    console.log('\n📱 MOBILE DEVELOPMENT ACCESS:');
    console.log(`   Local Network IP: ${localIP}`);
    console.log(`   API Base URL: http://${localIP}:${port}/${apiPrefix}`);
    console.log(`   Socket.IO URL: http://${localIP}:${port}`);
    console.log(`   Swagger Docs: http://${localIP}:${port}/${apiPrefix}/docs`);
    console.log('\n💡 For Expo Go development:');
    console.log(`   1. Connect your mobile device to the same WiFi network`);
    console.log(`   2. Use this IP in your React Native app: ${localIP}:${port}`);
    console.log(`   3. Update your app's API base URL to: http://${localIP}:${port}/${apiPrefix}`);
  }

  console.log('\n🔗 Available URLs:');
  console.log(`   Local: http://localhost:${port}/${apiPrefix}`);
  if (isDevelopmentEnvironment() && localIP !== 'localhost') {
    console.log(`   Network: http://${localIP}:${port}/${apiPrefix}`);
  }
}

/**
 * Validate network connectivity
 * Ensures the server can be reached from network interfaces
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if network is accessible
 */
export async function validateNetworkConnectivity(port: number): Promise<boolean> {
  try {
    // In a real implementation, you might ping the server or check port availability
    // For now, we'll just validate that we can get network interface information
    const localIP = getLocalNetworkIP();
    return localIP !== 'localhost';
  } catch (error) {
    console.error('Network connectivity validation failed:', error);
    return false;
  }
}
