import { ClientCommunicator } from './ClientCommunicator';
import { AuthManager } from './AuthManager';

/**
 * Example: ClientCommunicator with authentication
 * 
 * This demonstrates:
 * - Setting up authentication
 * - Using tokens
 * - Handling auth failures
 */

// Generate some tokens for testing
const testToken1 = AuthManager.generateSecureToken(32);
const testToken2 = AuthManager.generateSecureToken(32);

console.log('\n🔑 Generated test tokens:');
console.log(`Token 1: ${testToken1}`);
console.log(`Token 2: ${testToken2}`);
console.log('\nTo use these tokens, set in client:');
console.log(`API_TOKEN=${testToken1} bun client.ts\n`);

// Initialize communicator with authentication
const communicator = new ClientCommunicator({
  port: 8013,
  hostname: '0.0.0.0',
  authConfig: {
    required: true, // Require authentication
    tokens: [testToken1, testToken2], // Valid tokens
  }
});

// Event handlers
communicator.on('client:connected', (client) => {
  console.log(`\n✅ Client connected: ${client.name} (${client.clientId})`);
  console.log(`   Authenticated: ${client.authenticated}`);
  
  if (client.authenticated) {
    setTimeout(() => testCommand(client.clientId), 2000);
  }
});

communicator.on('client:disconnected', (clientId) => {
  console.log(`\n❌ Client disconnected: ${clientId}`);
});

communicator.on('command:started', (result) => {
  console.log(`\n▶️ Command started: ${result.command}`);
});

communicator.on('command:stdout', (execId, chunk) => {
  process.stdout.write(chunk);
});

communicator.on('command:stderr', (execId, chunk) => {
  process.stderr.write(`\x1b[31m${chunk}\x1b[0m`);
});

communicator.on('command:completed', (result) => {
  console.log(`\n✅ Command completed (exit: ${result.exitCode})`);
});

communicator.on('command:error', (execId, error) => {
  console.error(`\n❌ Command error: ${error}`);
});

// Start server
communicator.start();

// Display authentication info
const authManager = communicator.getAuthManager();
console.log('\n🔐 Authentication Configuration:');
console.log(`   Auth required: ${authManager.isAuthRequired()}`);
console.log(`   Valid tokens: ${authManager.getTokenCount()}`);
console.log('\n⏳ Waiting for authenticated clients...\n');

/**
 * Test command execution
 */
async function testCommand(clientId: string) {
  console.log(`\n📤 Sending test command to ${clientId}...`);
  
  const command = process.platform === 'win32'
    ? 'echo Authenticated && ping -n 2 127.0.0.1'
    : 'echo Authenticated && ping -c 2 127.0.0.1';
  
  try {
    const result = await communicator.executeCommand(clientId, command, {
      timeout: 30000
    });
    
    console.log(`\n📊 Command ID: ${result.execId}`);
    
    const final = await communicator.waitForCompletion(result.execId);
    
    console.log(`\n🎯 Final result:`);
    console.log(`   Exit code: ${final.exitCode}`);
    console.log(`   Duration: ${final.completedAt!.getTime() - final.startedAt.getTime()}ms`);
    
  } catch (err) {
    console.error(`\n❌ Error:`, err);
  }
}

// Status report every 30 seconds
setInterval(() => {
  const totalClients = communicator.getClientCount();
  const authenticatedClients = communicator.getAuthenticatedClientCount();
  const running = communicator.getRunningExecutions();
  
  console.log(`\n📊 Status:`);
  console.log(`   Total clients: ${totalClients}`);
  console.log(`   Authenticated: ${authenticatedClients}`);
  console.log(`   Unauthenticated: ${totalClients - authenticatedClients}`);
  console.log(`   Running commands: ${running.length}`);
  
  const clients = communicator.getClients();
  if (clients.length > 0) {
    console.log(`\n   Connected clients:`);
    clients.forEach(c => {
      const status = c.authenticated ? '🔓 Authenticated' : '🔒 Not authenticated';
      console.log(`   - ${c.name} (${c.clientId}): ${status}`);
    });
  }
}, 30000);

// Token management example
setTimeout(() => {
  console.log('\n\n🔧 Token Management Example:');
  
  // Add a new token at runtime
  const newToken = AuthManager.generateSecureToken(32);
  authManager.addToken(newToken, {
    name: 'Runtime Generated Token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000), // Expires in 1 hour
  });
  
  console.log(`   Added new token: ${newToken}`);
  console.log(`   Total tokens: ${authManager.getTokenCount()}`);
  
  // You can also remove tokens
  // authManager.removeToken(someToken);
  
  // Check if auth is required
  console.log(`   Auth required: ${authManager.isAuthRequired()}`);
  
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Shutting down...');
  communicator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Shutting down...');
  communicator.stop();
  process.exit(0);
});
