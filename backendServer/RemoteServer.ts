import { Server as BunServer, ServerWebSocket } from 'bun';
import { AuthManager, type AuthConfig } from './AuthManager';

/**
 * типы сообщений между сервером и клиентами
 */
export type MessageType = 
  | 'welcome'
  | 'hello'
  | 'command'
  | 'result'
  | 'error'
  | 'broadcast'
  | 'ping'
  | 'pong'
  | 'status'
  | 'stdout'
  | 'stderr'
  | 'ack';

/**
 * Интерфейс для данных клиента
 */
export interface ClientData {
  clientId: string;
  name?: string;
  os?: string;
  arch?: string;
  connectedAt: Date;
  lastPing?: Date;
  authenticated: boolean;
  token?: string;
}

/**
 * Интерфейс для входящего сообщения
 */
export interface IncomingMessage {
  type: MessageType;
  command?: string;
  clientId?: string;
  name?: string;
  os?: string;
  arch?: string;
  token?: string;
  [key: string]: any;
}

/**
 * Интерфейс для исходящего сообщения
 */
export interface OutgoingMessage {
  type: MessageType;
  clientId?: string;
  message?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  data?: any;
  timestamp?: string;
}

/**
 * Расширенный WebSocket с пользовательскими данными
 */
export interface ExtendedWebSocket extends ServerWebSocket<ClientData> {
  data: ClientData;
}

/**
 * RemoteServer configuration options
 */
export interface RemoteServerOptions {
  port?: number;
  hostname?: string;
  authConfig?: Partial<AuthConfig>;
}

/**
 * Класс RemoteServer - WebSocket сервер для управления удалёнными клиентами
 */
export class RemoteServer {
  private port: number;
  private hostname: string;
  private clients: Map<string, ExtendedWebSocket> = new Map();
  private server: BunServer<never> | null = null;
  private messageHandlers: Map<MessageType, (ws: ExtendedWebSocket, msg: IncomingMessage) => void> = new Map();
  private authManager: AuthManager;

  constructor(port?: number, hostname?: string, authConfig?: Partial<AuthConfig>);
  constructor(options: RemoteServerOptions);
  constructor(
    portOrOptions: number | RemoteServerOptions = 8080,
    hostname: string = '0.0.0.0',
    authConfig?: Partial<AuthConfig>
  ) {
    if (typeof portOrOptions === 'object') {
      this.port = portOrOptions.port || 8080;
      this.hostname = portOrOptions.hostname || '0.0.0.0';
      this.authManager = new AuthManager(portOrOptions.authConfig || {});
    } else {
      this.port = portOrOptions;
      this.hostname = hostname;
      this.authManager = new AuthManager(authConfig || {});
    }
    
    this.registerDefaultHandlers();
  }

  /**
   * Запускает сервер
   */
  public start(): void {
    this.server = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: (req, server) => this.handleFetch(req, server),
      websocket: {
        open: (ws) => this.handleOpen(ws),
        message: (ws, message) => this.handleMessage(ws, message),
        close: (ws) => this.handleClose(ws),
        ping: (ws, data) => { ws.pong(data); },
      },
      error: (error) => {
        console.error('[RemoteServer] Ошибка сервера:', error);
      },
    });

    console.log(`🚀 [RemoteServer] WebSocket сервер запущен на ws://${this.hostname}:${this.port}`);
  }

  /**
   * Останавливает сервер
   */
  public stop(): void {
    if (this.server) {
      this.server.stop();
      this.clients.clear();
      console.log('🛑 [RemoteServer] Сервер остановлен');
      this.server = null;
    }
  }

  /**
   * Обработчик HTTP запросов
   */
  private handleFetch(req: Request, server: BunServer<never>): Response {
    const url = new URL(req.url);

    // Обновление WebSocket
    if (server.upgrade(req)) {
      return new Response(null, { status: 101 });
    }

    // Проверка статуса сервера
    if (url.pathname === '/status' && req.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'running',
          connectedClients: this.clients.size,
          clients: Array.from(this.clients.values()).map(ws => ({
            id: ws.data?.clientId,
            name: ws.data?.name,
            connectedAt: ws.data?.connectedAt,
          })),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('WebSocket только', { status: 400 });
  }

  /**
   * Обработчик открытия соединения
   */
  private handleOpen(ws: ExtendedWebSocket): void {
    const clientId = crypto.randomUUID().slice(0, 8);
    ws.data = {
      clientId,
      connectedAt: new Date(),
      authenticated: false, // Will be set to true after successful auth
    };

    this.clients.set(clientId, ws);
    console.log(`📱 [RemoteServer] Клиент подключился: ${clientId}`);

    // Отправляем приветствие с требованием аутентификации
    this.sendMessage(ws, {
      type: 'welcome',
      clientId,
      message: this.authManager.isAuthRequired() 
        ? 'Welcome to RemoteServer. Authentication required.'
        : 'Добро пожаловать на RemoteServer',
      data: {
        authRequired: this.authManager.isAuthRequired(),
      },
      timestamp: new Date().toISOString(),
    });

    // If auth is not required, mark as authenticated immediately
    if (!this.authManager.isAuthRequired()) {
      ws.data.authenticated = true;
    }
  }

  /**
   * Обработчик входящих сообщений
   */
  private handleMessage(ws: ExtendedWebSocket, message: string | Buffer): void {
    try {
      const messageStr = typeof message === 'string' 
        ? message 
        : new TextDecoder().decode(message);
      
      const data: IncomingMessage = JSON.parse(messageStr);

      console.log(`💬 [RemoteServer] Сообщение ${data.type} от ${ws.data?.clientId}:`, data);

      // Обновляем время последнего контакта
      if (ws.data) {
        ws.data.lastPing = new Date();
      }

      // Вызываем зарегистрированный обработчик
      const handler = this.messageHandlers.get(data.type);
      if (handler) {
        console.log(`🔧 [RemoteServer] Обработка сообщения типа ${data.type} от ${ws.data?.clientId}`);
        console.log(handler);
        handler(ws, data);
      } else {
        console.warn(`⚠️ [RemoteServer] Неизвестный тип сообщения: ${data.type}`);
      }
    } catch (err) {
      console.error('[RemoteServer] Ошибка обработки сообщения:', err);
      this.sendMessage(ws, {
        type: 'error',
        message: `Ошибка обработки: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * Обработчик закрытия соединения
   */
  private handleClose(ws: ExtendedWebSocket): void {
    if (ws.data) {
      const clientId = ws.data.clientId;
      this.clients.delete(clientId);
      console.log(`🔌 [RemoteServer] Клиент отключился: ${clientId}`);
    }
  }

  /**
   * Регистрирует обработчик для типа сообщения
   */
  public on(type: MessageType, handler: (ws: ExtendedWebSocket, msg: IncomingMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Регистрирует обработчики по умолчанию
   */
  private registerDefaultHandlers(): void {
    this.on('hello', (ws, msg) => {
      // Validate token if auth is required
      console.log(`👋 [RemoteServer] check validation tokens `);
      if (this.authManager.isAuthRequired()) {
        const isValid = this.authManager.validateToken(msg.token);
        
        if (!isValid) {
          console.warn(`⚠️ [RemoteServer] Invalid token from ${ws.data?.clientId}`);
          
          // Send error and close connection
          this.sendMessage(ws, {
            type: 'error',
            message: 'Authentication failed: Invalid or missing token',
            data: { code: 'AUTH_FAILED' },
          });
          
          // Close connection after a brief delay
          setTimeout(() => {
            ws.close(1008, 'Authentication failed');
            if (ws.data) {
              this.clients.delete(ws.data.clientId);
            }
          }, 100);
          
          return;
        }
        
        // Mark as authenticated
        if (ws.data) {
          ws.data.authenticated = true;
          ws.data.token = msg.token;
        }
        
        console.log(`🔐 [RemoteServer] Client authenticated: ${ws.data?.clientId}`);
      }
      
      // Update client data
      if (ws.data) {
        ws.data.name = msg.name;
        ws.data.os = msg.os;
        ws.data.arch = msg.arch;
      }
      
      console.log(`✨ [RemoteServer] Клиент представился: ${msg.name}`);
    });

    this.on('pong', (ws, msg) => {
      if (ws.data) {
        ws.data.lastPing = new Date();
      }
    });
  }

  /**
   * Отправляет сообщение конкретному клиенту
   */
  public sendMessage(ws: ExtendedWebSocket, message: OutgoingMessage): void {
    try {
      const payload = JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      });
      ws.send(payload);
    } catch (err) {
      console.error('[RemoteServer] Ошибка отправки сообщения:', err);
    }
  }

  /**
   * Отправляет команду конкретному клиенту по ID
   */
  public sendCommandToClient(clientId: string, command: string): boolean {
    const ws = this.clients.get(clientId);
    if (!ws) {
      console.warn(`⚠️ [RemoteServer] Клиент не найден: ${clientId}`);
      return false;
    }
    
    // Check if client is authenticated
    if (this.authManager.isAuthRequired() && !ws.data?.authenticated) {
      console.warn(`⚠️ [RemoteServer] Client not authenticated: ${clientId}`);
      return false;
    }
    
    this.sendMessage(ws, {
      type: 'command',
      command,
      clientId,
    });
    console.log(`📤 [RemoteServer] Команда отправлена ${clientId}: ${command}`);
    return true;
  }

  /**
   * Отправляет сообщение всем подключённым клиентам (broadcast)
   */
  public broadcast(message: OutgoingMessage): void {
    const payload = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });

    for (const ws of this.clients.values()) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error('[RemoteServer] Ошибка broadcast:', err);
      }
    }
    console.log(`📢 [RemoteServer] Broadcast отправлен ${this.clients.size} клиентам`);
  }

  /**
   * Отправляет ping всем клиентам для проверки живучести
   */
  public healthCheck(): void {
    const payload = JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString(),
    });

    for (const ws of this.clients.values()) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error('[RemoteServer] Ошибка health check:', err);
      }
    }
  }

  /**
   * Получить информацию о всех подключённых клиентах
   */
  public getClients(): ClientData[] {
    return Array.from(this.clients.values())
      .filter(ws => ws.data)
      .map(ws => ws.data!);
  }

  /**
   * Получить информацию о конкретном клиенте
   */
  public getClient(clientId: string): ClientData | undefined {
    return this.clients.get(clientId)?.data;
  }

  /**
   * Количество подключённых клиентов
   */
  public getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get authentication manager
   * 
   * @returns AuthManager instance
   */
  public getAuthManager(): AuthManager {
    return this.authManager;
  }
  
  /**
   * Get number of authenticated clients
   * 
   * @returns Number of authenticated clients
   */
  public getAuthenticatedClientCount(): number {
    return Array.from(this.clients.values())
      .filter(ws => ws.data?.authenticated)
      .length;
  }

  /**
   * Get registered message handlers
   * @returns Map of message handlers
   */
  public getMessageHandlers(): Map<MessageType, (ws: ExtendedWebSocket, msg: IncomingMessage) => void> {
    return this.messageHandlers;
  }
}