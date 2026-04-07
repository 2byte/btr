import { RemoteServer } from './RemoteServer';
import type { ClientData, ExtendedWebSocket, RemoteServerOptions } from './RemoteServer';
import { EventEmitter } from 'events';
import { AuthManager, type AuthConfig } from './AuthManager';

/**
 * Command execution options
 */
export interface CommandOptions {
  /**
   * Execution ID (unique identifier for tracking)
   * If not provided, will be auto-generated
   */
  execId?: string;
  
  /**
   * Timeout in milliseconds (optional)
   */
  timeout?: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /**
   * Unique execution identifier
   */
  execId: string;
  
  /**
   * Client ID that executed the command
   */
  clientId: string;
  
  /**
   * Command that was executed
   */
  command: string;
  
  /**
   * Exit code (available after completion)
   */
  exitCode?: number;
  
  /**
   * Full stdout output (accumulated)
   */
  stdout: string;
  
  /**
   * Full stderr output (accumulated)
   */
  stderr: string;
  
  /**
   * Execution status
   */
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout' | 'killed';
  
  /**
   * Start time
   */
  startedAt: Date;
  
  /**
   * Completion time (if completed)
   */
  completedAt?: Date;
  
  /**
   * Error message (if any)
   */
  error?: string;
}

/**
 * Events emitted by ClientCommunicator
 */
export interface ClientCommunicatorEvents {
  /**
   * Emitted when a new client connects
   */
  'client:connected': (clientData: ClientData) => void;
  
  /**
   * Emitted when a client disconnects
   */
  'client:disconnected': (clientId: string) => void;
  
  /**
   * Emitted when command execution starts
   */
  'command:started': (result: CommandResult) => void;
  
  /**
   * Emitted when stdout chunk is received
   */
  'command:stdout': (execId: string, chunk: string, result: CommandResult) => void;
  
  /**
   * Emitted when stderr chunk is received
   */
  'command:stderr': (execId: string, chunk: string, result: CommandResult) => void;
  
  /**
   * Emitted when command completes
   */
  'command:completed': (result: CommandResult) => void;
  
  /**
   * Emitted when command errors
   */
  'command:error': (execId: string, error: string, result: CommandResult) => void;
  
  /**
   * Emitted when command times out
   */
  'command:timeout': (result: CommandResult) => void;
  
  /**
   * Emitted when command is killed
   */
  'command:killed': (result: CommandResult) => void;
}

/**
 * ClientCommunicator - High-level API for managing remote clients and executing commands
 * 
 * Features:
 * - Send commands to specific clients
 * - Receive streaming output (stdout/stderr)
 * - Track command execution status
 * - Kill running commands
 * - Manage connected clients
 * - Event-based architecture
 * - Authentication support
 */
export class ClientCommunicator extends EventEmitter {
  private server: RemoteServer;
  private executions: Map<string, CommandResult> = new Map();
  private timeouts: Map<string, Timer> = new Map();

  constructor(port?: number, hostname?: string, authConfig?: Partial<AuthConfig>);
  constructor(options: RemoteServerOptions);
  constructor(
    portOrOptions: number | RemoteServerOptions = 8080,
    hostname: string = '0.0.0.0',
    authConfig?: Partial<AuthConfig>
  ) {
    super();
    
    if (typeof portOrOptions === 'object') {
      this.server = new RemoteServer(portOrOptions);
    } else {
      this.server = new RemoteServer(portOrOptions, hostname, authConfig);
    }
    
    this.setupServerHandlers();
  }

  /**
   * Start the WebSocket server
   */
  public start(): void {
    this.server.start();
    console.log('🎯 [ClientCommunicator] Started');
  }

  /**
   * Stop the WebSocket server
   */
  public stop(): void {
    // Clear all timeouts
    for (const timer of this.timeouts.values()) {
      clearTimeout(timer);
    }
    this.timeouts.clear();
    this.executions.clear();
    
    this.server.stop();
    console.log('🛑 [ClientCommunicator] Stopped');
  }

  /**
   * Setup internal handlers for RemoteServer events
   */
  private setupServerHandlers(): void {
    // Handle client hello (identification)
    if (this.server.getMessageHandlers().has('hello')) {
      console.warn('⚠️ [ClientCommunicator] Warning: RemoteServer already has a handler for "hello" messages. Client connection events may not be emitted correctly.');
      // Run the existing handler in addition to our own
      const originalHelloHandler = this.server.getMessageHandlers().get('hello')!
      this.server.on('hello', (ws, msg) => {
        originalHelloHandler(ws, msg);
        if (ws.data) {
          console.log(`✅ [ClientCommunicator] Client connected: ${ws.data.clientId} (${msg.name})`);
          this.emit('client:connected', ws.data);
        }
      });
    }

    // Handle command status updates
    this.server.on('status', (ws, msg) => {
      const { execId, status, command } = msg.data || {};
      
      if (execId && status === 'started') {
        const result = this.executions.get(execId);
        if (result) {
          result.status = 'running';
          console.log(`▶️ [ClientCommunicator] Command started: ${execId}`);
          this.emit('command:started', result);
        }
      }
    });

    // Handle stdout chunks
    this.server.on('stdout', (ws, msg) => {
      const { execId, chunk } = msg as any;
      
      if (execId && chunk) {
        const result = this.executions.get(execId);
        if (result) {
          result.stdout += chunk;
          this.emit('command:stdout', execId, chunk, result);
        }
      }
    });

    // Handle stderr chunks
    this.server.on('stderr', (ws, msg) => {
      const { execId, chunk } = msg as any;
      
      if (execId && chunk) {
        const result = this.executions.get(execId);
        if (result) {
          result.stderr += chunk;
          this.emit('command:stderr', execId, chunk, result);
        }
      }
    });

    // Handle command completion
    this.server.on('result', (ws, msg) => {
      const execId = msg.execId || msg.data?.execId;
      
      if (execId) {
        const result = this.executions.get(execId);
        if (result) {
          result.status = 'completed';
          result.exitCode = msg.exitCode;
          result.completedAt = new Date();
          
          // Clear timeout if exists
          const timeout = this.timeouts.get(execId);
          if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(execId);
          }
          
          console.log(`✅ [ClientCommunicator] Command completed: ${execId} (exit: ${msg.exitCode})`);
          this.emit('command:completed', result);
        }
      }
    });

    // Handle client errors
    this.server.on('error', (ws, msg) => {
      console.error(`❌ [ClientCommunicator] Client error: ${msg.message}`);
      
      // Try to find associated execution
      const execId = msg.execId || msg.data?.execId;
      if (execId) {
        const result = this.executions.get(execId);
        if (result) {
          result.status = 'error';
          result.error = msg.message;
          result.completedAt = new Date();
          this.emit('command:error', execId, msg.message || 'Unknown error', result);
        }
      }
    });

    // Handle acknowledgments (e.g., kill confirmations)
    this.server.on('ack', (ws, msg) => {
      const { execId, action, success } = msg as any;
      
      if (action === 'kill' && execId) {
        const result = this.executions.get(execId);
        if (result && success) {
          result.status = 'killed';
          result.completedAt = new Date();
          console.log(`🛑 [ClientCommunicator] Command killed: ${execId}`);
          this.emit('command:killed', result);
        }
      }
    });
  }

  /**
   * Execute a command on a specific client
   * 
   * @param clientId - Target client ID
   * @param command - Shell command to execute
   * @param options - Execution options (timeout, execId)
   * @returns Command result object with execution tracking
   */
  public async executeCommand(
    clientId: string,
    command: string,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    const client = this.getClient(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const execId = options.execId || crypto.randomUUID();
    
    // Create execution tracking object
    const result: CommandResult = {
      execId,
      clientId,
      command,
      stdout: '',
      stderr: '',
      status: 'pending',
      startedAt: new Date(),
    };
    
    this.executions.set(execId, result);

    // Setup timeout if specified
    if (options.timeout) {
      const timer = setTimeout(() => {
        const exec = this.executions.get(execId);
        if (exec && exec.status !== 'completed') {
          exec.status = 'timeout';
          exec.completedAt = new Date();
          console.log(`⏱️ [ClientCommunicator] Command timeout: ${execId}`);
          this.emit('command:timeout', exec);
          
          // Try to kill the command
          this.killCommand(clientId, execId).catch(err => {
            console.error(`Failed to kill timed out command: ${err}`);
          });
        }
        this.timeouts.delete(execId);
      }, options.timeout);
      
      this.timeouts.set(execId, timer);
    }

    // Send command to client
    const sent = this.server.sendCommandToClient(clientId, command);
    
    if (!sent) {
      result.status = 'error';
      result.error = 'Failed to send command to client';
      result.completedAt = new Date();
      throw new Error(result.error);
    }

    console.log(`📤 [ClientCommunicator] Command sent: ${execId} → ${clientId}: ${command}`);
    
    return result;
  }

  /**
   * Kill a running command
   * 
   * @param clientId - Target client ID
   * @param execId - Execution ID to kill
   */
  public async killCommand(clientId: string, execId: string): Promise<void> {
    const client = this.server.getClient(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Get the WebSocket for this client
    const clients = this.server['clients'] as Map<string, ExtendedWebSocket>;
    const ws = clients.get(clientId);
    
    if (!ws) {
      throw new Error(`WebSocket not found for client: ${clientId}`);
    }

    // Send kill command
    this.server.sendMessage(ws, {
      type: 'command',
      action: 'kill',
      execId,
    } as any);

    console.log(`🛑 [ClientCommunicator] Kill request sent: ${execId}`);
  }

  /**
   * Get execution result by ID
   * 
   * @param execId - Execution ID
   * @returns Command result or undefined
   */
  public getExecution(execId: string): CommandResult | undefined {
    return this.executions.get(execId);
  }

  /**
   * Get all executions for a specific client
   * 
   * @param clientId - Client ID
   * @returns Array of command results
   */
  public getClientExecutions(clientId: string): CommandResult[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.clientId === clientId);
  }

  /**
   * Get all running executions
   * 
   * @returns Array of running command results
   */
  public getRunningExecutions(): CommandResult[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.status === 'running' || exec.status === 'pending');
  }

  /**
   * Clean up old completed executions
   * 
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  public cleanupExecutions(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [execId, result] of this.executions.entries()) {
      if (result.status === 'completed' || result.status === 'error' || result.status === 'killed') {
        const completedAt = result.completedAt?.getTime() || result.startedAt.getTime();
        if (now - completedAt > maxAge) {
          this.executions.delete(execId);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 [ClientCommunicator] Cleaned up ${cleaned} old executions`);
    }
    
    return cleaned;
  }

  /**
   * Get all connected clients
   * 
   * @returns Array of client data
   */
  public getClients(): ClientData[] {
    return this.server.getClients();
  }

  /**
   * Get specific client by ID
   * 
   * @param clientId - Client ID
   * @returns Client data or undefined
   */
  public getClient(clientId: string): ClientData | undefined {
    return this.server.getClient(clientId);
  }

  /**
   * Find clients by name pattern
   * 
   * @param namePattern - Name pattern (regex or string)
   * @returns Array of matching clients
   */
  public findClientsByName(namePattern: string | RegExp): ClientData[] {
    const pattern = typeof namePattern === 'string' 
      ? new RegExp(namePattern, 'i') 
      : namePattern;
    
    return this.getClients().filter(client => 
      client.name && pattern.test(client.name)
    );
  }

  /**
   * Get number of connected clients
   * 
   * @returns Client count
   */
  public getClientCount(): number {
    return this.server.getClientCount();
  }

  /**
   * Broadcast a command to all connected clients
   * 
   * @param command - Command to execute
   * @param options - Execution options
   * @returns Array of command results
   */
  public async broadcastCommand(
    command: string,
    options: CommandOptions = {}
  ): Promise<CommandResult[]> {
    const clients = this.getClients();
    const results: CommandResult[] = [];
    
    for (const client of clients) {
      try {
        const result = await this.executeCommand(client.clientId, command, options);
        results.push(result);
      } catch (err) {
        console.error(`Failed to send command to ${client.clientId}:`, err);
      }
    }
    
    console.log(`📢 [ClientCommunicator] Broadcast command to ${results.length} clients`);
    return results;
  }

  /**
   * Perform health check on all clients
   */
  public healthCheck(): void {
    this.server.healthCheck();
  }

  /**
   * Wait for a command to complete
   * 
   * @param execId - Execution ID
   * @param timeout - Maximum wait time in ms (default: 30s)
   * @returns Promise that resolves with the result
   */
  public async waitForCompletion(execId: string, timeout: number = 30000): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const result = this.executions.get(execId);
      
      if (!result) {
        return reject(new Error(`Execution not found: ${execId}`));
      }

      // Already completed
      if (result.status === 'completed' || result.status === 'error' || result.status === 'killed') {
        return resolve(result);
      }

      // Setup timeout
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Wait timeout for execution: ${execId}`));
      }, timeout);

      // Setup completion handler
      const onComplete = (completedResult: CommandResult) => {
        if (completedResult.execId === execId) {
          cleanup();
          resolve(completedResult);
        }
      };

      const onError = (errorExecId: string) => {
        if (errorExecId === execId) {
          cleanup();
          resolve(result); // Resolve with current state
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.off('command:completed', onComplete);
        this.off('command:error', onError);
        this.off('command:killed', onComplete);
        this.off('command:timeout', onComplete);
      };

      this.on('command:completed', onComplete);
      this.on('command:error', onError);
      this.on('command:killed', onComplete);
      this.on('command:timeout', onComplete);
    });
  }

  /**
   * Get authentication manager
   * 
   * @returns AuthManager instance
   */
  public getAuthManager(): AuthManager {
    return this.server.getAuthManager();
  }

  /**
   * Get number of authenticated clients
   * 
   * @returns Number of authenticated clients
   */
  public getAuthenticatedClientCount(): number {
    return this.server.getAuthenticatedClientCount();
  }

  /**
   * Get underlying RemoteServer instance
   * 
   * @returns RemoteServer instance
   */
  public getServer(): RemoteServer {
    return this.server;
  }
}
