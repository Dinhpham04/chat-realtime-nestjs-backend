import { networkInterfaces } from 'os';
import * as net from 'net';

/**
 * Network Testing Utility
 * Test local network configuration for voice/video call development
 */

/**
 * Test network configuration
 */
async function testNetworkConfiguration() {
  console.log('🧪 TESTING NETWORK CONFIGURATION\n');

  // Test 1: Get network interfaces
  console.log('📡 1. Network Interfaces:');
  const interfaces = networkInterfaces();

  Object.keys(interfaces).forEach(interfaceName => {
    const interfaceDetails = interfaces[interfaceName];
    if (interfaceDetails) {
      interfaceDetails.forEach(detail => {
        if (detail.family === 'IPv4' && !detail.internal) {
          console.log(`   ✅ ${interfaceName}: ${detail.address} (${detail.family})`);
        }
      });
    }
  });

  // Test 2: Get local network IP
  const localIP = getLocalNetworkIP();
  console.log(`\n🌐 2. Detected Local IP: ${localIP}`);

  // Test 3: Test CORS origins
  const corsOrigins = getCorsOrigins();
  console.log('\n🔐 3. CORS Origins:');
  corsOrigins.forEach(origin => {
    console.log(`   - ${origin}`);
  });

  // Test 4: Test port availability
  console.log('\n🔌 4. Port Availability Test:');
  const port = 3000;
  const isPortAvailable = await testPortAvailability(port);
  console.log(`   Port ${port}: ${isPortAvailable ? '✅ Available' : '❌ In Use'}`);

  // Test 5: Environment check
  console.log('\n🌍 5. Environment:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Development Mode: ${isDevelopmentEnvironment()}`);
  console.log(`   Server Host: ${getServerHost()}`);

  console.log('\n🎯 NETWORK READY FOR MOBILE TESTING!');
}

function getLocalNetworkIP(): string {
  const interfaces = networkInterfaces();
  const candidates: Array<{ address: string, priority: number, interfaceName: string }> = [];

  for (const interfaceName of Object.keys(interfaces)) {
    const interfaceDetails = interfaces[interfaceName];

    if (!interfaceDetails) continue;

    for (const detail of interfaceDetails) {
      if (
        detail.family === 'IPv4' &&
        !detail.internal &&
        detail.address !== '127.0.0.1'
      ) {
        let priority = 0;

        // Same priority logic as server
        if (interfaceName.toLowerCase().includes('wifi')) {
          priority = 10; // Highest priority for WiFi
        } else if (interfaceName.toLowerCase().includes('ethernet') && !interfaceName.toLowerCase().includes('vethernet')) {
          priority = 9; // High priority for real Ethernet
        } else if (detail.address.startsWith('192.168.') || detail.address.startsWith('10.') || detail.address.startsWith('172.16.')) {
          if (interfaceName.toLowerCase().includes('wsl') || interfaceName.toLowerCase().includes('vethernet')) {
            priority = 1; // Very low priority for WSL/virtual
          } else {
            priority = 5; // Medium priority for other private networks
          }
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
    return candidates[0].address;
  }

  return 'localhost';
} function isDevelopmentEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

function getServerHost(): string {
  if (isDevelopmentEnvironment()) {
    return '0.0.0.0';
  }
  return process.env.HOST || 'localhost';
}

function getCorsOrigins(): string[] {
  const baseOrigins = ['http://localhost:3000'];

  if (isDevelopmentEnvironment()) {
    const localIP = getLocalNetworkIP();
    const port = 3000;

    const localNetworkOrigins = [
      `http://${localIP}:${port}`,
      `http://${localIP}:8081`,
      `http://${localIP}:19000`,
      `http://${localIP}:19001`,
    ];

    return [...baseOrigins, ...localNetworkOrigins];
  }

  return baseOrigins;
}

async function testPortAvailability(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.close(() => {
        resolve(true); // Port is available
      });
    });

    server.on('error', () => {
      resolve(false); // Port is in use
    });
  });
}

// Run the test
if (require.main === module) {
  testNetworkConfiguration().catch(console.error);
}

export { testNetworkConfiguration };
