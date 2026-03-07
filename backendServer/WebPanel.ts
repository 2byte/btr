import express, { Request, Response, NextFunction } from 'express';
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { ClientCommunicator } from './ClientCommunicator';
import { TerminalSessionManager } from './TerminalSessionManager';
import { RemoteServer, ClientData } from './RemoteServer';
import { AuthManager } from './AuthManager';

/**
 * WebPanel options
 */
export interface WebPanelOptions {
  /** Server hostname for display in dashboard URL (e.g. localhost or IP address)
   * @default 'localhost'
   */
  hostname?: string; // Server hostname (for display in dashboard URL)
  /**
   * Port for web panel HTTP server
   * @default 3000
   */
  port?: number;

  /**
   * Path to static files (public directory)
   * @default './public'
   */
  publicPath?: string;

  /**
   * Enable authentication
   * @default true
   */
  enableAuth?: boolean;

  /**
   * Authentication token (if enableAuth is true)
   * Can also be loaded from environment variables
   */
  authToken?: string;
}

/**
 * WebSocket message from browser client
 */
interface WSMessage {
  type: 'terminal:create' | 'terminal:input' | 'terminal:resize' | 'terminal:close' | 
        'files:list' | 'files:read' | 'files:mkdir' | 'files:delete' | 'files:rename' | 'files:write' | 'files:drives' |
        'client:list' | 'auth';
  sessionId?: string;
  clientId?: string;
  data?: any;
  cols?: number;
  rows?: number;
  token?: string;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

/**
 * Extended WebSocket with metadata
 */
interface ExtendedWS extends WebSocket {
  authenticated?: boolean;
  clientId?: string;
  subscribedClients?: Set<string>;
}

/**
 * Web Panel for managing remote clients via browser
 * 
 * Features:
 * - Web-based terminal UI using xterm.js
 * - Client list and status
 * - Real-time terminal sessions
 * - Authentication support
 * - RESTful API for client management
 * 
 * @example
 * ```typescript
 * const server = new RemoteServer({ port: 8080 });
 * const communicator = new ClientCommunicator(server);
 * const webPanel = new WebPanel(communicator, server, {
 *   port: 3000,
 *   publicPath: './public',
 *   enableAuth: true
 * });
 * 
 * await webPanel.start();
 * console.log('Web panel available at http://localhost:3000');
 * ```
 */
export class WebPanel {
  private app: express.Application;
  private httpServer?: HTTPServer;
  private wss?: WebSocketServer;
  private communicator: ClientCommunicator;
  private remoteServer: RemoteServer;
  private terminalManager: TerminalSessionManager;
  private options: Required<WebPanelOptions>;
  private authManager?: AuthManager;
  private clients: Map<WebSocket, ExtendedWS>;

  constructor(
    communicator: ClientCommunicator,
    remoteServer: RemoteServer,
    options: WebPanelOptions = {}
  ) {
    this.communicator = communicator;
    this.remoteServer = remoteServer;
    this.options = {
      port: options.port ?? 3000,
      publicPath: options.publicPath ?? './public',
      enableAuth: options.enableAuth ?? true,
      authToken: options.authToken ?? process.env.WEB_PANEL_TOKEN ?? '',
      hostname: options.hostname ?? 'localhost'
    };

    this.clients = new Map();
    this.app = express();
    this.terminalManager = new TerminalSessionManager(remoteServer);

    // Initialize auth if enabled
    if (this.options.enableAuth) {
      this.authManager = communicator.getAuthManager();
      if (!this.authManager) {
        console.warn('[WebPanel] Auth enabled but no AuthManager found. Creating default...');
        this.authManager = new AuthManager();
      }
    }

    this.setupMiddleware();
    this.setupRoutes();
    this.setupTerminalEvents();
    this.setupRemoteServerHandlers();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // CORS (allows browser to connect from different origin)
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Static files (HTML, CSS, JS, xterm.js)
    const publicDir = path.resolve(this.options.publicPath);
    this.app.use(express.static(publicDir));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[WebPanel] ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Authentication middleware for HTTP
   */
  private authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.options.enableAuth || !this.authManager) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.query.token as string;

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const isValid = this.authManager.validateToken(token);
    if (!isValid) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    next();
  };

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Dashboard - main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(path.resolve(this.options.publicPath), 'dashboard.html'));
    });

    // Terminal page for specific client
    this.app.get('/terminal/:clientId', (req, res) => {
      res.sendFile(path.join(path.resolve(this.options.publicPath), 'terminal.html'));
    });

    // File manager page for specific client
    this.app.get('/files/:clientId', (req, res) => {
      res.sendFile(path.join(path.resolve(this.options.publicPath), 'file-manager.html'));
    });

    // API: Download file from client
    this.app.get('/api/files/download/:clientId', this.authMiddleware, async (req, res) => {
      const { clientId } = req.params;
      const filePath = req.query.path as string;

      if (!filePath) {
        res.status(400).json({ error: 'File path is required' });
        return;
      }

      try {
        // Request file content from client
        const fileName = path.basename(filePath);
        
        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        // This is a simplified implementation - in production you'd want to:
        // 1. Request file from client via WebSocket
        // 2. Stream the response back to browser
        // 3. Handle large files with chunking
        
        // For now, we'll return an error indicating this needs client implementation
        res.status(501).json({ 
          error: 'File download not yet implemented - needs streaming support' 
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // API: Get list of connected clients
    this.app.get('/api/clients', this.authMiddleware, (req, res) => {
      const clients = this.getConnectedClients();
      res.json({ clients });
    });

    // API: Get specific client info
    this.app.get('/api/clients/:clientId', this.authMiddleware, (req, res) => {
      const { clientId } = req.params;
      const client = this.getClientInfo(clientId);
      
      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json({ client });
    });

    // API: Execute command on client
    this.app.post('/api/clients/:clientId/execute', this.authMiddleware, async (req, res) => {
      const { clientId } = req.params;
      const { command, timeout } = req.body;

      if (!command) {
        res.status(400).json({ error: 'Command is required' });
        return;
      }

      try {
        const result = await this.communicator.executeCommand(clientId, command, { timeout });
        res.json({ result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // API: Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        connectedClients: this.getConnectedClients().length,
        activeSessions: this.terminalManager.getActiveSessions().length
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Setup terminal event handlers
   */
  private setupTerminalEvents(): void {
    // Forward terminal output to WebSocket clients
    this.terminalManager.on('terminal:output', (sessionId: string, data: string | Buffer) => {
      this.broadcastToSession(sessionId, {
        type: 'terminal:output',
        sessionId,
        data: data.toString()
      });
    });

    // Terminal session created
    this.terminalManager.on('session:created', (sessionId: string, clientId: string) => {
      console.log(`[WebPanel] Terminal session created: ${sessionId} for client ${clientId}`);
    });

    // Terminal session closed
    this.terminalManager.on('session:closed', (sessionId: string, code: number | null) => {
      console.log(`[WebPanel] Terminal session closed: ${sessionId} (code: ${code})`);
      this.broadcastToSession(sessionId, {
        type: 'terminal:exit',
        sessionId,
        code
      });
    });

    // Terminal ready
    this.terminalManager.on('terminal:ready', (sessionId: string) => {
      this.broadcastToSession(sessionId, {
        type: 'terminal:ready',
        sessionId
      });
    });

    // Terminal error
    this.terminalManager.on('terminal:error', (sessionId: string, error: Error) => {
      console.error(`[WebPanel] Terminal error for session ${sessionId}:`, error);
      this.broadcastToSession(sessionId, {
        type: 'terminal:error',
        sessionId,
        error: error.message
      });
    });
  }

  /**
   * Setup handlers for messages from remote clients
   */
  private setupRemoteServerHandlers(): void {
    console.log('[WebPanel] Setting up RemoteServer message handlers...');
    
    // Handle terminal output from clients
    this.remoteServer.registerMessageHandler('terminal:output', (ws, msg) => {
      console.log(`[WebPanel] Received terminal:output from client ${ws.data.clientId} for session ${msg.sessionId}`);
      if (msg.sessionId && msg.data) {
        this.terminalManager.handleOutput(msg.sessionId, msg.data);
      }
    });

    // Handle terminal ready from clients
    this.remoteServer.registerMessageHandler('terminal:ready', (ws, msg) => {
      console.log(`[WebPanel] Received terminal:ready from client ${ws.data.clientId} for session ${msg.sessionId}`);
      if (msg.sessionId) {
        this.terminalManager.handleReady(msg.sessionId);
      }
    });

    // Handle terminal exit from clients
    this.remoteServer.registerMessageHandler('terminal:exit', (ws, msg) => {
      console.log(`[WebPanel] Received terminal:exit from client ${ws.data.clientId} for session ${msg.sessionId} with code ${msg.code}`);
      if (msg.sessionId) {
        this.terminalManager.handleExit(msg.sessionId, msg.code ?? null);
      }
    });

    // Handle terminal error from clients
    this.remoteServer.registerMessageHandler('terminal:error', (ws, msg) => {
      console.error(`[WebPanel] Received terminal:error from client ${ws.data.clientId} for session ${msg.sessionId}: ${msg.error}`);
      if (msg.sessionId && msg.error) {
        this.terminalManager.handleError(msg.sessionId, new Error(msg.error));
      }
    });

    // Handle file list response from clients
    this.remoteServer.registerMessageHandler('files:list', (ws, msg) => {
      console.log(`[WebPanel] Received files:list from client ${ws.data.clientId}`);
      // Broadcast to all authenticated WebPanel clients
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file content response from clients
    this.remoteServer.registerMessageHandler('files:content', (ws, msg) => {
      console.log(`[WebPanel] Received files:content from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file created response from clients
    this.remoteServer.registerMessageHandler('files:created', (ws, msg) => {
      console.log(`[WebPanel] Received files:created from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file deleted response from clients
    this.remoteServer.registerMessageHandler('files:deleted', (ws, msg) => {
      console.log(`[WebPanel] Received files:deleted from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file renamed response from clients
    this.remoteServer.registerMessageHandler('files:renamed', (ws, msg) => {
      console.log(`[WebPanel] Received files:renamed from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle drives list response from clients
    this.remoteServer.registerMessageHandler('files:drives', (ws, msg) => {
      console.log(`[WebPanel] Received files:drives from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file written response from clients
    this.remoteServer.registerMessageHandler('files:written', (ws, msg) => {
      console.log(`[WebPanel] Received files:written from client ${ws.data.clientId}`);
      this.broadcastToAuthenticatedClients(msg);
    });

    // Handle file error response from clients
    this.remoteServer.registerMessageHandler('files:error', (ws, msg) => {
      console.error(`[WebPanel] Received files:error from client ${ws.data.clientId}: ${msg.error}`);
      this.broadcastToAuthenticatedClients(msg);
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    if (!this.httpServer) {
      throw new Error('HTTP server not started');
    }

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const extWs = ws as ExtendedWS;
      extWs.authenticated = !this.options.enableAuth; // Auto-auth if disabled
      extWs.subscribedClients = new Set();
      this.clients.set(ws, extWs);

      console.log('[WebPanel] New WebSocket connection');

      // Send welcome message
      this.sendWS(ws, {
        type: 'welcome',
        authRequired: this.options.enableAuth
      });

      ws.on('message', async (message: Buffer) => {
        try {
          const data: WSMessage = JSON.parse(message.toString());
          await this.handleWSMessage(ws, data);
        } catch (error) {
          console.error('[WebPanel] Error handling WS message:', error);
          this.sendWS(ws, {
            type: 'error',
            error: String(error)
          });
        }
      });

      ws.on('close', () => {
        console.log('[WebPanel] WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[WebPanel] WebSocket error:', error);
      });
    });

    console.log(`[WebPanel] WebSocket server started at ws://localhost:${this.options.port}/ws`);
  }

  /**
   * Handle WebSocket messages from browser
   */
  private async handleWSMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const extWs = ws as ExtendedWS;

    // Authentication
    if (message.type === 'auth') {
      if (!this.options.enableAuth) {
        extWs.authenticated = true;
        this.sendWS(ws, { type: 'auth', success: true });
        return;
      }

      if (!message.token || !this.authManager) {
        this.sendWS(ws, { type: 'auth', success: false, error: 'Invalid token' });
        return;
      }

      const isValid = this.authManager.validateToken(message.token);
      if (isValid) {
        extWs.authenticated = true;
        this.sendWS(ws, { type: 'auth', success: true });
      } else {
        this.sendWS(ws, { type: 'auth', success: false, error: 'Invalid token' });
      }
      return;
    }

    // Check authentication for other messages
    if (this.options.enableAuth && !extWs.authenticated) {
      this.sendWS(ws, { type: 'error', error: 'Not authenticated' });
      return;
    }

    // Handle different message types
    switch (message.type) {
      case 'client:list':
        this.sendWS(ws, {
          type: 'client:list',
          clients: this.getConnectedClients()
        });
        break;

      case 'terminal:create':
        if (!message.clientId) {
          this.sendWS(ws, { type: 'error', error: 'clientId is required' });
          return;
        }

        console.log(`[WebPanel] Creating terminal session for client: ${message.clientId}`);

        try {
          const sessionId = await this.terminalManager.createSession(
            message.clientId,
            {
              cols: message.cols ?? 80,
              rows: message.rows ?? 24,
              cwd: message.cwd,
              env: message.env,
              shell: message.shell
            }
          );

          extWs.clientId = message.clientId;
          extWs.subscribedClients?.add(message.clientId);

          this.sendWS(ws, {
            type: 'terminal:create',
            sessionId,
            clientId: message.clientId
          });
        } catch (error) {
          this.sendWS(ws, {
            type: 'error',
            error: String(error)
          });
        }
        break;

      case 'terminal:input':
        if (!message.sessionId || !message.data) {
          this.sendWS(ws, { type: 'error', error: 'sessionId and data are required' });
          return;
        }

        try {
          console.log(`[WebPanel] Sending input to session ${message.sessionId}: ${JSON.stringify(message.data)}`);
          await this.terminalManager.sendInput(message.sessionId, message.data);
        } catch (error) {
          console.error(`[WebPanel] Error sending input to session ${message.sessionId}:`, error);
          this.sendWS(ws, {
            type: 'error',
            error: String(error)
          });
        }
        break;

      case 'terminal:resize':
        if (!message.sessionId || !message.cols || !message.rows) {
          this.sendWS(ws, { type: 'error', error: 'sessionId, cols, and rows are required' });
          return;
        }

        try {
          await this.terminalManager.resize(message.sessionId, message.cols, message.rows);
        } catch (error) {
          this.sendWS(ws, {
            type: 'error',
            error: String(error)
          });
        }
        break;

      case 'terminal:close':
        if (!message.sessionId) {
          this.sendWS(ws, { type: 'error', error: 'sessionId is required' });
          return;
        }

        try {
          await this.terminalManager.closeSession(message.sessionId);
        } catch (error) {
          this.sendWS(ws, {
            type: 'error',
            error: String(error)
          });
        }
        break;

      // File system operations
      case 'files:list':
      case 'files:read':
      case 'files:mkdir':
      case 'files:delete':
      case 'files:rename':
      case 'files:write':
      case 'files:drives':
        if (!message.clientId) {
          this.sendWS(ws, { type: 'error', error: 'clientId is required for file operations' });
          return;
        }

        console.log(`[WebPanel] File operation ${message.type} for client: ${message.clientId}`);

        try {
          // Forward file operation to RemoteServer which will relay to client
          this.remoteServer.sendToClient(message.clientId, message as any);
        } catch (error) {
          console.error(`[WebPanel] Error forwarding file operation:`, error);
          this.sendWS(ws, {
            type: 'files:error',
            error: String(error)
          });
        }
        break;

      default:
        this.sendWS(ws, {
          type: 'error',
          error: `Unknown message type: ${message.type}`
        });
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendWS(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all clients subscribed to a session
   */
  private broadcastToSession(sessionId: string, data: any): void {
    const message = JSON.stringify(data);
    
    for (const [ws, extWs] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        // Send to all authenticated clients (they can filter by sessionId)
        if (extWs.authenticated) {
          ws.send(message);
        }
      }
    }
  }

  /**
   * Broadcast message to all authenticated WebPanel clients
   */
  private broadcastToAuthenticatedClients(data: any): void {
    const message = JSON.stringify(data);
    
    for (const [ws, extWs] of this.clients) {
      if (ws.readyState === WebSocket.OPEN && extWs.authenticated) {
        ws.send(message);
      }
    }
  }

  /**
   * Get list of connected clients
   */
  private getConnectedClients(): ClientData[] {
    const clientsMap = this.remoteServer.getClientsMap();
    return Array.from(clientsMap.values()).map(ws => ws.data);
  }

  /**
   * Get specific client info
   */
  private getClientInfo(clientId: string): ClientData | undefined {
    const clientsMap = this.remoteServer.getClientsMap();
    const ws = clientsMap.get(clientId);
    return ws?.data;
  }

  /**
   * Start web panel server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.app.listen(this.options.port, this.options.hostname, () => {
        console.log(`🌐 [WebPanel] HTTP server started on http://${this.options.hostname}:${this.options.port}`);
        console.log(`📁 [WebPanel] Serving static files from: ${path.resolve(this.options.publicPath)}`);
        console.log(`🔐 [WebPanel] Authentication: ${this.options.enableAuth ? 'ENABLED' : 'DISABLED'}`);
        
        this.setupWebSocket();
        resolve();
      });
    });
  }

  /**
   * Stop web panel server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all WebSocket connections
      if (this.wss) {
        this.wss.clients.forEach((client) => {
          client.close();
        });
        this.wss.close((err) => {
          if (err) console.error('[WebPanel] Error closing WebSocket server:', err);
        });
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close((err) => {
          if (err) {
            console.error('[WebPanel] Error closing HTTP server:', err);
            reject(err);
          } else {
            console.log('[WebPanel] Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app (for testing or extending)
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get terminal manager (for external access)
   */
  getTerminalManager(): TerminalSessionManager {
    return this.terminalManager;
  }
}
