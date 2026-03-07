import { ClientCommunicator } from "./ClientCommunicator";
import { WebPanel } from "./WebPanel";

export interface ServerConfig {
  // RemoteServer port (for clients to connect)
  serverPort: number;

  serverHostname?: string; // Optional hostname for RemoteServer (default: 'localhost')

  // WebPanel port (for browser access)
  webPanelPort: number;

  // Enable authentication (recommended for production)
  enableAuth: boolean;

  // Path to public files
  publicPath: string;

  // Token configuration (optional, used if enableAuth is true)
  authTokens?: string[]; // List of valid tokens (if authentication is enabled)
}

export class ServerBuilder {
  private configBundle: Partial<ServerConfig> = {};

  constructor() {
    // Initialize with default config
    this.configBundle = ServerBuilder.getDefaultConfig();
  }

  static getDefaultConfig(): ServerConfig {
    return {
      serverPort: 8080,
      serverHostname: "localhost",
      webPanelPort: 3000,
      enableAuth: false,
      publicPath: "./public",
      authTokens: [],
    };
  }

  static init() {
    return new ServerBuilder();
  }

  port(port: number): this {
    this.configBundle.serverPort = port;
    return this;
  }

  webPanelPort(port: number): this {
    this.configBundle.webPanelPort = port;
    return this;
  }

  enableAuth(enabled: boolean = true): this {
    this.configBundle.enableAuth = enabled;
    return this;
  }

  publicPath(path: string): this {
    this.configBundle.publicPath = path;
    return this;
  }

  authTokens(tokens: string[]): this {
    this.configBundle.authTokens = tokens;
    return this;
  }

  serverHostname(hostname: string): this {
    this.configBundle.serverHostname = hostname;
    return this;
  }

  build(): ServerRunner {
    return new ServerRunner(this.configBundle as ServerConfig);
  }
}

export class ServerRunner {
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  async start() {
    console.log("🚀 Starting Remote Terminal System...\n");

    // 1. Create ClientCommunicator (creates RemoteServer internally)
    console.log(`📡 Creating ClientCommunicator on port ${this.config.serverPort}...`);
    const communicator = new ClientCommunicator(
      this.config.serverPort,
      this.config.serverHostname || 'localhost',
      { required: this.config.enableAuth, tokens: this.config.authTokens } // Auth config
    );

    // 2. Get RemoteServer from communicator
    const server = communicator.getServer();

    // 3. Create WebPanel (web UI + API)
    console.log(`🌐 Creating WebPanel on port ${this.config.webPanelPort}...`);
    const webPanel = new WebPanel(communicator, server, {
      port: this.config.webPanelPort,
      publicPath: this.config.publicPath,
      enableAuth: this.config.enableAuth,
    });

    // Optional: Add custom event handlers
    this.setupEventHandlers(communicator, webPanel);

    // 4. Start servers
    console.log("\n⏳ Starting servers...\n");

    communicator.start();
    await webPanel.start();

    console.log("\n✅ System is ready!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Dashboard:  http://" + (this.config.serverHostname || 'localhost') + ":" + this.config.webPanelPort);
    console.log("🔌 WS Server:  ws://" + (this.config.serverHostname || 'localhost') + ":" + this.config.serverPort);
    console.log("📡 API:        http://" + (this.config.serverHostname || 'localhost') + ":" + this.config.webPanelPort + "/api/clients");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Next steps:");
    console.log("   1. Start a client: bun run backendServer/client.ts");
    console.log("   2. Open dashboard in browser");
    console.log('   3. Click "Open Terminal" on a client\n');

    if (!this.config.enableAuth) {
      console.log("⚠️  WARNING: Authentication is DISABLED!");
      console.log("   This is OK for development, but enable it for production.\n");
    }

    if (this.config.enableAuth && !this.config.authTokens?.length) {
      console.log("⚠️  WARNING: Authentication is ENABLED but no tokens are provided!");
      console.log("   This will prevent any client from connecting.\n");
    }

    // Graceful shutdown
    this.setupGracefulShutdown(communicator, webPanel);
  }

  async run() {
    try {
      await this.start();
    } catch (error) {
      console.error("❌ Error starting server:", error);
    }
  }

  /**
   * Setup event handlers for logging and monitoring
   */
  setupEventHandlers(communicator: ClientCommunicator, webPanel: WebPanel): void {
    const termManager = webPanel.getTerminalManager();

    // Client connected
    communicator.on("client:connected", (clientId: string) => {
      console.log(`✨ Client connected: ${clientId}`);
    });

    // Client disconnected
    communicator.on("client:disconnected", (clientId: string) => {
      console.log(`👋 Client disconnected: ${clientId}`);
    });

    // Terminal session created
    termManager.on("session:created", (sessionId: string, clientId: string) => {
      console.log(`🖥️  Terminal session created: ${sessionId} (client: ${clientId})`);
    });

    // Terminal session closed
    termManager.on("session:closed", (sessionId: string, code: number | null) => {
      console.log(`🔚 Terminal session closed: ${sessionId} (exit code: ${code})`);
    });

    // Terminal error
    termManager.on("terminal:error", (sessionId: string, error: Error) => {
      console.error(`❌ Terminal error in session ${sessionId}:`, error.message);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown(communicator: ClientCommunicator, webPanel: WebPanel): void {
    const shutdown = async () => {
      console.log("\n\n🛑 Shutting down gracefully...");

      try {
        await webPanel.stop();
        console.log("✅ WebPanel stopped");

        communicator.stop();
        console.log("✅ ClientCommunicator stopped");

        console.log("👋 Goodbye!\n");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}
