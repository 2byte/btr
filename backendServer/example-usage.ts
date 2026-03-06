import { ClientCommunicator } from './ClientCommunicator';

/**
 * Example usage of ClientCommunicator
 * 
 * This demonstrates:
 * - Starting the server
 * - Listening to client connections
 * - Executing commands with streaming output
 * - Killing commands
 * - Broadcasting to all clients
 */

// Initialize the communicator
const communicator = new ClientCommunicator(8080, '0.0.0.0');

// Listen to client connection events
communicator.on('client:connected', (client) => {
  console.log(`\n🎉 New client connected!`);
  console.log(`   ID: ${client.clientId}`);
  console.log(`   Name: ${client.name || 'Unknown'}`);
  console.log(`   OS: ${client.os || 'Unknown'}`);
  console.log(`   Connected at: ${client.connectedAt.toISOString()}`);
});

communicator.on('client:disconnected', (clientId) => {
  console.log(`\n👋 Client disconnected: ${clientId}`);
});

// Listen to command events
communicator.on('command:started', (result) => {
  console.log(`\n▶️ Command started: ${result.execId}`);
  console.log(`   Client: ${result.clientId}`);
  console.log(`   Command: ${result.command}`);
});

communicator.on('command:stdout', (execId, chunk, result) => {
  // Print stdout in real-time
  process.stdout.write(chunk);
});

communicator.on('command:stderr', (execId, chunk, result) => {
  // Print stderr in real-time (in red)
  process.stderr.write(`\x1b[31m${chunk}\x1b[0m`);
});

communicator.on('command:completed', (result) => {
  console.log(`\n✅ Command completed: ${result.execId}`);
  console.log(`   Exit code: ${result.exitCode}`);
  console.log(`   Duration: ${result.completedAt!.getTime() - result.startedAt.getTime()}ms`);
  console.log(`   Stdout length: ${result.stdout.length} bytes`);
  console.log(`   Stderr length: ${result.stderr.length} bytes`);
});

communicator.on('command:error', (execId, error, result) => {
  console.error(`\n❌ Command error: ${execId}`);
  console.error(`   Error: ${error}`);
});

communicator.on('command:timeout', (result) => {
  console.log(`\n⏱️ Command timeout: ${result.execId}`);
});

communicator.on('command:killed', (result) => {
  console.log(`\n🛑 Command killed: ${result.execId}`);
});

// Start the server
communicator.start();

// Example 1: Execute command when a client connects
setTimeout(async () => {
  const clients = communicator.getClients();
  
  if (clients.length === 0) {
    console.log('\n⚠️ No clients connected yet. Waiting...');
    return;
  }

  const client = clients[0];
  console.log(`\n📤 Sending command to ${client.clientId}...`);

  try {
    // Execute a long-running command with streaming output
    const result = await communicator.executeCommand(
      client.clientId,
      process.platform === 'win32' 
        ? 'ping -n 5 127.0.0.1'  // Windows: 5 pings
        : 'ping -c 5 127.0.0.1', // Unix: 5 pings
      {
        timeout: 60000 // 60 second timeout
      }
    );

    console.log(`\n📊 Command tracking ID: ${result.execId}`);
    
    // Wait for completion
    const finalResult = await communicator.waitForCompletion(result.execId, 60000);
    console.log(`\n🎯 Final result:`, finalResult);
    
  } catch (err) {
    console.error(`\n❌ Error:`, err);
  }
}, 5000);

// Example 2: Broadcast command to all clients
setTimeout(async () => {
  const clients = communicator.getClients();
  
  if (clients.length === 0) {
    console.log('\n⚠️ No clients for broadcast');
    return;
  }

  console.log(`\n📢 Broadcasting command to ${clients.length} clients...`);
  
  const results = await communicator.broadcastCommand(
    process.platform === 'win32' ? 'echo Hello from server!' : 'echo "Hello from server!"'
  );
  
  console.log(`\n📊 Broadcast initiated for ${results.length} commands`);
}, 20000);

// Example 3: Kill a long-running command
setTimeout(async () => {
  const running = communicator.getRunningExecutions();
  
  if (running.length > 0) {
    const toKill = running[0];
    console.log(`\n🛑 Killing command: ${toKill.execId}`);
    
    try {
      await communicator.killCommand(toKill.clientId, toKill.execId);
      console.log('   Kill signal sent');
    } catch (err) {
      console.error('   Failed to kill:', err);
    }
  }
}, 15000);

// Periodic health check
setInterval(() => {
  communicator.healthCheck();
  
  const clients = communicator.getClients();
  console.log(`\n💓 Health check: ${clients.length} clients connected`);
  
  // Cleanup old executions (older than 30 minutes)
  communicator.cleanupExecutions(30 * 60 * 1000);
}, 60000);

// Periodic status report
setInterval(() => {
  const clients = communicator.getClients();
  const running = communicator.getRunningExecutions();
  
  console.log(`\n📊 Status Report:`);
  console.log(`   Connected clients: ${clients.length}`);
  console.log(`   Running commands: ${running.length}`);
  
  if (clients.length > 0) {
    console.log(`\n   Clients:`);
    for (const client of clients) {
      const executions = communicator.getClientExecutions(client.clientId);
      console.log(`     - ${client.clientId} (${client.name}) - ${executions.length} executions`);
    }
  }
  
  if (running.length > 0) {
    console.log(`\n   Running commands:`);
    for (const exec of running) {
      const duration = Date.now() - exec.startedAt.getTime();
      console.log(`     - ${exec.execId}: ${exec.command} (${Math.round(duration / 1000)}s)`);
    }
  }
}, 30000);

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
