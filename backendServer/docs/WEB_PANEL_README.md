# Web Panel - Remote Terminal Management

Веб-панель для управления удаленными клиентами через браузер с полноценными терминальными сессиями.

## 🎯 Возможности

- **Веб-интерфейс**: Управление через браузер, доступ из любого места
- **PTY терминалы**: Полноценные pseudo-terminal сессии с интерактивными приложениями
- **Xterm.js**: Профессиональный терминал как в VS Code, Termius
- **Real-time**: WebSocket для мгновенной передачи данных
- **Аутентификация**: Защита доступа через токены
- **Множественные клиенты**: Управление всеми подключенными машинами
- **Адаптивный UI**: Современный dark theme, responsive design

## 📋 Требования

### Зависимости

```bash
bun add express ws
bun add -d @types/express @types/ws
```

### Опционально (для PTY на клиентах)

```bash
bun add node-pty
bun add -d @types/node-pty
```

> **Примечание**: `node-pty` используется для полноценной эмуляции терминала. Если не установлен, будет использован fallback на `Bun.spawn` (ограниченный функционал).

## 🚀 Быстрый старт

### 1. Запуск сервера с веб-панелью

```typescript
// server.ts
import { RemoteServer } from './RemoteServer';
import { ClientCommunicator } from './ClientCommunicator';
import { WebPanel } from './WebPanel';

// Создаем основной сервер для клиентов
const server = new RemoteServer({ 
  port: 8080,
  enableAuth: true // Включаем аутентификацию
});

// Коммуникатор для управления клиентами
const communicator = new ClientCommunicator(server);

// Веб-панель на отдельном порту
const webPanel = new WebPanel(communicator, server, {
  port: 3000,                    // Порт для веб-интерфейса
  publicPath: './public',        // Путь к статическим файлам
  enableAuth: true,              // Требовать аутентификацию
});

await server.start();
await webPanel.start();

console.log('✅ Server running on ws://localhost:8080');
console.log('✅ Web Panel available at http://localhost:3000');
```

### 2. Запуск клиента

На удаленной машине:

```bash
bun run backendServer/client.ts
```

Клиент автоматически поддерживает терминальные сессии, если установлен `node-pty`.

### 3. Открываем веб-панель

1. Открываем браузер: `http://localhost:3000`
2. Вводим токен аутентификации (если включена)
3. Видим список подключенных клиентов
4. Открываем терминал для нужного клиента

## 🔐 Настройка аутентификации

### Генерация токена

```bash
# Генерируем токен
bun run backendServer/generate-token.ts --name "web-panel"

# Добавляем в .env
echo "WEB_PANEL_TOKEN=generated-token-here" >> .env
```

### Отключение аутентификации (только для разработки!)

```typescript
const webPanel = new WebPanel(communicator, server, {
  enableAuth: false  // ⚠️ НЕ ИСПОЛЬЗУЙТЕ в продакшене!
});
```

## 📚 API и интерфейс

### WebPanel Options

```typescript
interface WebPanelOptions {
  port?: number;              // Порт HTTP сервера (по умолчанию 3000)
  publicPath?: string;        // Путь к статическим файлам (по умолчанию './public')
  enableAuth?: boolean;       // Включить аутентификацию (по умолчанию true)
  authToken?: string;         // Токен аутентификации (или из env)
}
```

### REST API Endpoints

#### GET /api/clients

Получить список подключенных клиентов.

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "clients": [
    {
      "clientId": "client-123",
      "name": "MyPC",
      "os": "Windows_NT",
      "arch": "x64",
      "connectedAt": "2024-01-15T10:30:00.000Z",
      "authenticated": true
    }
  ]
}
```

#### GET /api/clients/:clientId

Получить информацию о конкретном клиенте.

**Response:**
```json
{
  "client": {
    "clientId": "client-123",
    "name": "MyPC",
    "os": "Windows_NT",
    "arch": "x64",
    "connectedAt": "2024-01-15T10:30:00.000Z",
    "authenticated": true
  }
}
```

#### POST /api/clients/:clientId/execute

Выполнить команду на клиенте.

**Body:**
```json
{
  "command": "echo Hello",
  "timeout": 30000
}
```

**Response:**
```json
{
  "result": {
    "execId": "exec-456",
    "clientId": "client-123",
    "command": "echo Hello",
    "exitCode": 0,
    "stdout": "Hello\n",
    "stderr": ""
  }
}
```

#### GET /api/health

Проверка состояния сервера.

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "connectedClients": 3,
  "activeSessions": 2
}
```

### WebSocket Protocol

WebSocket endpoint: `ws://localhost:3000/ws`

#### Аутентификация

```javascript
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-token-here'
}));

// Response
{
  type: 'auth',
  success: true
}
```

#### Создание терминальной сессии

```javascript
ws.send(JSON.stringify({
  type: 'terminal:create',
  clientId: 'client-123',
  cols: 80,
  rows: 24,
  cwd: '/home/user',  // опционально
  env: {},            // опционально
  shell: '/bin/bash'  // опционально
}));

// Response
{
  type: 'terminal:create',
  sessionId: 'session-789',
  clientId: 'client-123'
}
```

#### Отправка ввода в терминал

```javascript
ws.send(JSON.stringify({
  type: 'terminal:input',
  sessionId: 'session-789',
  data: 'ls -la\n'
}));
```

#### Получение вывода терминала

```javascript
// Server автоматически отправляет
{
  type: 'terminal:output',
  sessionId: 'session-789',
  data: 'total 48\ndrwxr-xr-x  5 user user 4096 ...'
}
```

#### Изменение размера терминала

```javascript
ws.send(JSON.stringify({
  type: 'terminal:resize',
  sessionId: 'session-789',
  cols: 120,
  rows: 30
}));
```

#### Закрытие терминальной сессии

```javascript
ws.send(JSON.stringify({
  type: 'terminal:close',
  sessionId: 'session-789'
}));

// Сервер отправит
{
  type: 'terminal:exit',
  sessionId: 'session-789',
  code: 0
}
```

## 🎨 Веб-интерфейс

### Dashboard (главная страница)

- **URL**: `http://localhost:3000/`
- **Функции**:
  - Список всех подключенных клиентов
  - Информация о каждом клиенте (OS, Arch, время подключения)
  - Кнопка "Open Terminal" для каждого клиента
  - Автообновление списка клиентов каждые 5 секунд

### Terminal (страница терминала)

- **URL**: `http://localhost:3000/terminal/:clientId`
- **Функции**:
  - Полноценный терминал с поддержкой:
    - Яркие цвета (ANSI escape codes)
    - Интерактивные приложения (vim, nano, htop)
    - Автокомплит и история команд
    - Копирование/вставка
    - Resize терминала по размеру окна
  - Индикатор состояния подключения
  - Кнопки: Reconnect, Clear, Close

### Кастомизация UI

Все UI файлы находятся в `public/`:

- `dashboard.html` - Главная страница
- `terminal.html` - Страница терминала
- `styles.css` - Общие стили

Вы можете редактировать эти файлы для изменения дизайна.

## 🔧 Расширенная настройка

### Кастомный путь к статическим файлам

```typescript
const webPanel = new WebPanel(communicator, server, {
  publicPath: '/var/www/terminal-ui'
});
```

### Интеграция с Express middleware

```typescript
const app = webPanel.getApp();

// Добавляем свои middleware
app.use('/custom', customMiddleware);

// Добавляем свои роуты
app.get('/custom/endpoint', (req, res) => {
  res.json({ custom: 'data' });
});
```

### Программное управление терминалами

```typescript
const terminalManager = webPanel.getTerminalManager();

// Создать сессию программно
const sessionId = await terminalManager.createSession('client-123', {
  cols: 80,
  rows: 24,
  shell: '/bin/bash'
});

// Отправить команду
await terminalManager.sendInput(sessionId, 'ls -la\n');

// Изменить размер
await terminalManager.resize(sessionId, 120, 30);

// Закрыть сессию
await terminalManager.closeSession(sessionId);

// Получить активные сессии
const sessions = terminalManager.getActiveSessions();
```

### События терминала

```typescript
terminalManager.on('terminal:output', (sessionId, data) => {
  console.log(`Output from ${sessionId}:`, data);
});

terminalManager.on('session:created', (sessionId, clientId) => {
  console.log(`Session ${sessionId} created for client ${clientId}`);
});

terminalManager.on('session:closed', (sessionId, code) => {
  console.log(`Session ${sessionId} closed with code ${code}`);
});

terminalManager.on('terminal:error', (sessionId, error) => {
  console.error(`Error in session ${sessionId}:`, error);
});
```

## 🐛 Отладка

### Просмотр логов

WebPanel выводит подробные логи:

```
🌐 [WebPanel] HTTP server started on http://localhost:3000
📁 [WebPanel] Serving static files from: /path/to/public
🔐 [WebPanel] Authentication: ENABLED
[WebPanel] WebSocket server started at ws://localhost:3000/ws
[WebPanel] New WebSocket connection
[WebPanel] Terminal session created: session-789 for client client-123
```

### Проверка WebSocket соединения

В консоли браузера (F12):

```javascript
// Проверить WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
```

### Проверка REST API

```bash
# Получить список клиентов
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/clients

# Health check
curl http://localhost:3000/api/health
```

## ⚠️ Безопасность

### Production рекомендации

1. **Всегда используйте аутентификацию** в продакшене
2. **HTTPS/WSS**: Разверните за reverse proxy (nginx, Caddy)
3. **Firewall**: Ограничьте доступ к портам
4. **Токены**: Используйте надежные токены, регулярно ротируйте
5. **CORS**: Настройте CORS для конкретных доменов

### Пример nginx конфигурации

```nginx
server {
    listen 443 ssl;
    server_name terminal.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 📊 Производительность

- **Lightweight**: Минимальные накладные расходы
- **Efficient streams**: Данные передаются напрямую без буферизации
- **Scalable**: Поддерживает множество одновременных сессий
- **Optimized**: WebSocket для минимальной задержки

## 🧪 Тестирование

### Быстрый тест

```typescript
// test-web-panel.ts
import { RemoteServer } from './RemoteServer';
import { ClientCommunicator } from './ClientCommunicator';
import { WebPanel } from './WebPanel';

const server = new RemoteServer({ port: 8080, enableAuth: false });
const communicator = new ClientCommunicator(server);
const webPanel = new WebPanel(communicator, server, {
  port: 3000,
  enableAuth: false
});

await server.start();
await webPanel.start();

console.log('Test server running!');
console.log('Open http://localhost:3000');

// Graceful shutdown
process.on('SIGINT', async () => {
  await webPanel.stop();
  await server.stop();
  process.exit(0);
});
```

Запуск:

```bash
bun run test-web-panel.ts
```

## 📖 См. также

- [CLIENT_COMMUNICATOR_README.md](./CLIENT_COMMUNICATOR_README.md) - API для управления клиентами
- [AUTH_README.md](./AUTH_README.md) - Подробности об аутентификации
- [QUICKSTART.md](./QUICKSTART.md) - Общее руководство по использованию
- [README.md](./README.md) - Основная документация

## 💡 Примеры использования

### Простой пример

```typescript
import { RemoteServer, ClientCommunicator, WebPanel } from './backendServer';

const server = new RemoteServer({ port: 8080 });
const communicator = new ClientCommunicator(server);
const webPanel = new WebPanel(communicator, server, { port: 3000 });

await server.start();
await webPanel.start();
```

### С аутентификацией

```typescript
const server = new RemoteServer({ 
  port: 8080,
  enableAuth: true,
  tokens: ['client-token-1', 'client-token-2']
});

const communicator = new ClientCommunicator(server);

const webPanel = new WebPanel(communicator, server, {
  port: 3000,
  enableAuth: true,
  authToken: 'web-panel-token'
});

await server.start();
await webPanel.start();
```

### С кастомными обработчиками

```typescript
const webPanel = new WebPanel(communicator, server, { port: 3000 });

const termManager = webPanel.getTerminalManager();

termManager.on('terminal:output', (sessionId, data) => {
  // Логируем все команды
  console.log(`[${sessionId}]`, data.toString());
});

termManager.on('session:created', async (sessionId, clientId) => {
  // Отправляем welcome message
  await termManager.sendInput(sessionId, 'echo "Welcome to remote terminal!"\n');
});

await webPanel.start();
```

## 🎉 Готово!

Теперь у вас есть полноценная веб-панель для управления удаленными терминалами, как в профессиональных инструментах (Termius, VS Code Remote, etc).

**Запускаем:**
```bash
bun run backendServer/index.ts
```

**Открываем:**
```
http://localhost:3000
```

Наслаждайтесь! 🚀
