import { EventEmitter } from 'events';
import { RemoteServer, type ExtendedWebSocket, type ClientData } from './RemoteServer';

/**
 * Terminal session configuration
 */
export interface TerminalSessionOptions {
  /**
   * Number of columns (default: 80)
   */
  cols?: number;
  
  /**
   * Number of rows (default: 24)
   */
  rows?: number;
  
  /**
   * Working directory (optional)
   */
  cwd?: string;
  
  /**
   * Environment variables (optional)
   */
  env?: Record<string, string>;
  
  /**
   * Shell to use (auto-detect if not provided)
   */
  shell?: string;
}

/**
 * Terminal session data
 */
export interface TerminalSession {
  /**
   * Unique session identifier
   */
  sessionId: string;
  
  /**
   * Client ID that owns this session
   */
  clientId: string;
  
  /**
   * Session status
   */
  status: 'pending' | 'active' | 'closed';
  
  /**
   * Terminal dimensions
   */
  cols: number;
  rows: number;
  
  /**
   * Shell being used
   */
  shell?: string;
  
  /**
   * Creation time
   */
  createdAt: Date;
  
  /**
   * Close time (if closed)
   */
  closedAt?: Date;
  
  /**
   * Exit code (if closed)
   */
  exitCode?: number;
  
  /**
   * Working directory
   */
  cwd?: string;
}

/**
 * Events emitted by TerminalSessionManager
 */
export interface TerminalSessionEvents {
  /**
   * Emitted when a session is created
   */
  'session:created': (session: TerminalSession) => void;
  
  /**
   * Emitted when terminal output is received
   */
  'session:output': (sessionId: string, data: string) => void;
  
  /**
   * Emitted when a session is closed
   */
  'session:closed': (sessionId: string, exitCode?: number) => void;
  
  /**
   * Emitted when session status changes
   */
  'session:status': (sessionId: string, status: string) => void;
}

/**
 * TerminalSessionManager - Manages PTY terminal sessions for remote clients
 * 
 * Features:
 * - Create interactive terminal sessions
 * - Send input to terminals
 * - Receive real-time output
 * - Resize terminals
 * - Multiple sessions per client
 * - Session lifecycle management
 */
export class TerminalSessionManager extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private clientSessions: Map<string, Set<string>> = new Map(); // clientId -> Set<sessionId>
  private remoteServer: RemoteServer;
  
  constructor(remoteServer: RemoteServer) {
    super();
    this.remoteServer = remoteServer;
    
    // Listen for client disconnection to cleanup sessions
    // Use EventEmitter's on() method
    (this.remoteServer as any).on('client:disconnected', (data: any) => {
      const { clientId } = data;
      console.log(`[TerminalSessionManager] Client ${clientId} disconnected, cleaning up sessions`);
      
      // Find and close all sessions for this client
      const sessionsToClose: string[] = [];
      this.sessions.forEach((session) => {
        if (session.clientId === clientId) {
          sessionsToClose.push(session.sessionId);
        }
      });
      
      sessionsToClose.forEach((sessionId) => {
        console.log(`[TerminalSessionManager] Auto-closing session ${sessionId} for disconnected client ${clientId}`);
        this.closeSession(sessionId);
      });
    });
  }

  /**
   * Create a new terminal session
   * 
   * @param clientId - Client ID 
   * @param options - Session options
   * @returns Session ID   */
  public async createSession(
    clientId: string,
    options: TerminalSessionOptions = {}
  ): Promise<string> {
    const sessionId = crypto.randomUUID();
    
    const session: TerminalSession = {
      sessionId,
      clientId,
      status: 'pending',
      cols: options.cols || 80,
      rows: options.rows || 24,
      shell: options.shell,
      cwd: options.cwd,
      createdAt: new Date(),
    };
    
    // Store session
    this.sessions.set(sessionId, session);
    
    // Track sessions per client
    if (!this.clientSessions.has(clientId)) {
      this.clientSessions.set(clientId, new Set());
    }
    this.clientSessions.get(clientId)!.add(sessionId);
    
    console.log(`🖥️ [TerminalSessionManager] Creating session: ${sessionId} for client: ${clientId}`);
    
    // Send create command to client via RemoteServer
    this.remoteServer.sendToClient(clientId, {
      type: 'terminal:create',
      sessionId,
      cols: session.cols,
      rows: session.rows,
      cwd: options.cwd,
      env: options.env,
      shell: options.shell,
    });
    
    this.emit('session:created', sessionId, clientId);
    
    return sessionId;
  }

  /**
   * Send input to a terminal session
   * 
   * @param sessionId - Session ID
   * @param data - Input data to send
   */
  public async sendInput(sessionId: string, data: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ [TerminalSessionManager] Session not found: ${sessionId}`);
      return false;
    }
    
    if (session.status !== 'active' && session.status !== 'pending') {
      console.warn(`⚠️ [TerminalSessionManager] Session not active: ${sessionId} (status: ${session.status})`);
      return false;
    }
    
    console.log(`[TerminalSessionManager] Sending input to client ${session.clientId} for session ${sessionId}: ${JSON.stringify(data)}`);
    
    // Send input to client via RemoteServer
    const sent = this.remoteServer.sendToClient(session.clientId, {
      type: 'terminal:input',
      sessionId,
      data,
    });
    
    if (!sent) {
      console.error(`❌ [TerminalSessionManager] Failed to send input to client ${session.clientId}`);
    }
    
    return sent;
  }

  /**
   * Resize a terminal session
   * 
   * @param sessionId - Session ID
   * @param cols - New column count
   * @param rows - New row count
   */
  public async resize(sessionId: string, cols: number, rows: number): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ [TerminalSessionManager] Session not found: ${sessionId}`);
      return false;
    }
    
    session.cols = cols;
    session.rows = rows;
    
    // Send resize command to client via RemoteServer
    this.remoteServer.sendToClient(session.clientId, {
      type: 'terminal:resize',
      sessionId,
      cols,
      rows,
    });
    
    console.log(`📐 [TerminalSessionManager] Resized session ${sessionId}: ${cols}x${rows}`);
    
    return true;
  }

  /**
   * Close a terminal session
   * 
   * @param sessionId - Session ID
   */
  public async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    session.status = 'closed';
    session.closedAt = new Date();
    
    // Send close command to client via RemoteServer
    this.remoteServer.sendToClient(session.clientId, {
      type: 'terminal:close',
      sessionId,
    });
    
    // Remove from tracking
    const clientSessions = this.clientSessions.get(session.clientId);
    if (clientSessions) {
      clientSessions.delete(sessionId);
    }
    
    console.log(`🔚 [TerminalSessionManager] Closed session: ${sessionId}`);
    this.emit('session:closed', sessionId, session.exitCode);
    
    return true;
  }

  /**
   * Handle terminal output from client
   * 
   * @param sessionId - Session ID
   * @param data - Output data
   */
  public handleOutput(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    // Update status to active on first output
    if (session.status === 'pending') {
      session.status = 'active';
      this.emit('session:status', sessionId, 'active');
    }
    
    this.emit('terminal:output', sessionId, data);
  }

  /**
   * Handle terminal ready from client
   * 
   * @param sessionId - Session ID
   */
  public handleReady(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    // Update status to active
    session.status = 'active';
    
    console.log(`✅ [TerminalSessionManager] Terminal ready: ${sessionId}`);
    this.emit('terminal:ready', sessionId);
  }

  /**
   * Handle terminal error from client
   * 
   * @param sessionId - Session ID
   * @param error - Error object
   */
  public handleError(sessionId: string, error: Error): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    console.error(`❌ [TerminalSessionManager] Terminal error for session ${sessionId}:`, error);
    this.emit('terminal:error', sessionId, error);
  }

  /**
   * Handle terminal exit from client
   * 
   * @param sessionId - Session ID
   * @param exitCode - Exit code
   */
  public handleExit(sessionId: string, exitCode?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    session.status = 'closed';
    session.closedAt = new Date();
    session.exitCode = exitCode;
    
    console.log(`📤 [TerminalSessionManager] Session exited: ${sessionId} (code: ${exitCode})`);
    this.emit('session:closed', sessionId, exitCode);
    
    // Cleanup
    const clientSessions = this.clientSessions.get(session.clientId);
    if (clientSessions) {
      clientSessions.delete(sessionId);
    }
  }

  /**
   * Get session by ID
   * 
   * @param sessionId - Session ID
   * @returns Terminal session or undefined
   */
  public getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a client
   * 
   * @param clientId - Client ID
   * @returns Array of terminal sessions
   */
  public getClientSessions(clientId: string): TerminalSession[] {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds) {
      return [];
    }
    
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is TerminalSession => s !== undefined);
  }

  /**
   * Get all active sessions
   * 
   * @returns Array of active terminal sessions
   */
  public getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active');
  }

  /**
   * Get total number of sessions
   * 
   * @returns Session count
   */
  public getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get number of active sessions
   * 
   * @returns Active session count
   */
  public getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  /**
   * Close all sessions for a client
   * 
   * @param clientId - Client ID
   */
  public async closeClientSessions(clientId: string): Promise<number> {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds) {
      return 0;
    }
    
    let closed = 0;
    for (const sessionId of Array.from(sessionIds)) {
      if (await this.closeSession(sessionId)) {
        closed++;
      }
    }
    
    console.log(`🔚 [TerminalSessionManager] Closed ${closed} sessions for client: ${clientId}`);
    
    return closed;
  }

  /**
   * Clean up old closed sessions
   * 
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   * @returns Number of sessions cleaned
   */
  public cleanupSessions(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'closed' && session.closedAt) {
        const age = now - session.closedAt.getTime();
        if (age > maxAge) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 [TerminalSessionManager] Cleaned up ${cleaned} old sessions`);
    }
    
    return cleaned;
  }

  /**
   * Get statistics
   * 
   * @returns Session statistics
   */
  public getStats() {
    const sessions = Array.from(this.sessions.values());
    
    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      pending: sessions.filter(s => s.status === 'pending').length,
      closed: sessions.filter(s => s.status === 'closed').length,
      clients: this.clientSessions.size,
    };
  }
}
