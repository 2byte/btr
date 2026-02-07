import { Server as BunServer } from 'bun';

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
  | 'status';

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
export interface ExtendedWebSocket extends WebSocket {
  data?: ClientData;
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

  constructor(port: number = 8080, hostname: string = '0.0.0.0') {
    this.port = port;
    this.hostname = hostname;
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
  private handleFetch(req: Request, server: any): Response {
    const url = new URL(req.url);

    // Обновление WebSocket
    if (server.upgrade(req)) {
      return;
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
    };

    this.clients.set(clientId, ws);
    console.log(`📱 [RemoteServer] Клиент подключился: ${clientId}`);

    // Отправляем приветствие
    this.sendMessage(ws, {
      type: 'welcome',
      clientId,
      message: 'Добро пожаловать на RemoteServer',
      timestamp: new Date().toISOString(),
    });
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
    if (ws) {
      this.sendMessage(ws, {
        type: 'command',
        command,
        clientId,
      });
      console.log(`📤 [RemoteServer] Команда отправлена ${clientId}: ${command}`);
      return true;
    }
    console.warn(`⚠️ [RemoteServer] Клиент не найден: ${clientId}`);
    return false;
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
}