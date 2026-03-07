/**
 * Example: Web Panel for Remote Terminal Management
 * 
 * This example demonstrates how to set up a complete web-based
 * terminal management system.
 * 
 * Features:
 * - Web dashboard with client list
 * - Interactive terminal sessions via browser
 * - Real-time PTY communication
 * - Authentication support
 * - REST API for client management
 * 
 * To run this example:
 * 1. Start this server: `bun run backendServer/example-web-panel.ts`
 * 2. Start a client: `bun run backendServer/client.ts`
 * 3. Open browser: http://localhost:3000
 * 4. Click "Open Terminal" on any connected client
 */

import { ClientCommunicator } from './ClientCommunicator';
import { WebPanel } from './WebPanel';

// Configuration
const CONFIG = {
  // RemoteServer port (for clients to connect)
  serverPort: process.env.REMOTE_SERVER_PORT ? parseInt(process.env.REMOTE_SERVER_PORT) : 8080,
  
  // WebPanel port (for browser access)
  webPanelPort: process.env.WEB_PANEL_PORT ? parseInt(process.env.WEB_PANEL_PORT) : 3000,
  
  // Enable authentication (recommended for production)
  enableAuth: false,  // Set to true in production!
  
  // Path to public files
  publicPath: './public'
};

async function main() {
  console.log('🚀 Starting Remote Terminal System...\n');

  // 1. Create ClientCommunicator (creates RemoteServer internally)
  console.log(`📡 Creating ClientCommunicator on port ${CONFIG.serverPort}...`);
  const communicator = new ClientCommunicator(
    CONFIG.serverPort,
    '0.0.0.0',
    { required: CONFIG.enableAuth,  tokens: process.env.API_TOKEN ? [process.env.API_TOKEN] : [] } // Auth config  
  );

  // 2. Get RemoteServer from communicator
  const server = communicator.getServer();

  // 3. Create WebPanel (web UI + API)
  console.log(`🌐 Creating WebPanel on port ${CONFIG.webPanelPort}...`);
  const webPanel = new WebPanel(communicator, server, {
    port: CONFIG.webPanelPort,
    publicPath: CONFIG.publicPath,
    enableAuth: CONFIG.enableAuth
  });

  // Optional: Add custom event handlers
  setupEventHandlers(communicator, webPanel);

  // 4. Start servers
  console.log('\n⏳ Starting servers...\n');
  
  communicator.start();
  await webPanel.start();

  console.log('\n✅ System is ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Dashboard:  http://localhost:' + CONFIG.webPanelPort);
  console.log('🔌 WS Server:  ws://localhost:' + CONFIG.serverPort);
  console.log('📡 API:        http://localhost:' + CONFIG.webPanelPort + '/api/clients');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n💡 Next steps:');
  console.log('   1. Start a client: bun run backendServer/client.ts');
  console.log('   2. Open dashboard in browser');
  console.log('   3. Click "Open Terminal" on a client\n');

  if (!CONFIG.enableAuth) {
    console.log('⚠️  WARNING: Authentication is DISABLED!');
    console.log('   This is OK for development, but enable it for production.\n');
  }

  // Graceful shutdown
  setupGracefulShutdown(communicator, webPanel);
}

/**
 * Setup event handlers for logging and monitoring
 */
function setupEventHandlers(
  communicator: ClientCommunicator,
  webPanel: WebPanel
): void {
  const termManager = webPanel.getTerminalManager();

  // Client connected
  communicator.on('client:connected', (clientId: string) => {
    console.log(`✨ Client connected: ${clientId}`);
  });

  // Client disconnected
  communicator.on('client:disconnected', (clientId: string) => {
    console.log(`👋 Client disconnected: ${clientId}`);
  });

  // Terminal session created
  termManager.on('session:created', (sessionId: string, clientId: string) => {
    console.log(`🖥️  Terminal session created: ${sessionId} (client: ${clientId})`);
  });

  // Terminal session closed
  termManager.on('session:closed', (sessionId: string, code: number | null) => {
    console.log(`🔚 Terminal session closed: ${sessionId} (exit code: ${code})`);
  });

  // Terminal error
  termManager.on('terminal:error', (sessionId: string, error: Error) => {
    console.error(`❌ Terminal error in session ${sessionId}:`, error.message);
  });
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(
  communicator: ClientCommunicator,
  webPanel: WebPanel
): void {
  const shutdown = async () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    
    try {
      await webPanel.stop();
      console.log('✅ WebPanel stopped');
      
      communicator.stop();
      console.log('✅ ClientCommunicator stopped');
      
      console.log('👋 Goodbye!\n');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run the example
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
