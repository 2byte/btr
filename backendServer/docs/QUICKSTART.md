# Быстрый старт ClientCommunicator

## Что это?

**ClientCommunicator** - класс для управления удаленными клиентами через WebSocket с поддержкой:
- Выполнения команд с потоковым выводом (streaming stdout/stderr)
- Прерывания команд
- Broadcast на все клиенты
- Event-based архитектуры
- 🔐 **Аутентификации (NEW!)**

## Запуск за 30 секунд

### Вариант 1: Без аутентификации (для тестов)

### Вариант 1: Без аутентификации (для тестов)

#### 1. Запустить сервер

```bash
bun run backendServer/test-communicator.ts
```

#### 2. Запустить клиент (в другом терминале)

```bash
bun run backendServer/client.ts
```

### Вариант 2: С аутентификацией (рекомендуется) 🔐

#### 1. Сгенерировать токен

```bash
cd backendServer
bun generate-token.ts
```

Скопируйте сгенерированный токен.

#### 2. Запустить сервер

```bash
bun test-auth.ts
```

#### 3. Запустить клиент с токеном

```bash
API_TOKEN=your-token-here bun client.ts
```

### 3. Наблюдать результат

```
✅ Клиент подключен: remote-win32-a1b2c3 (12345678)
▶️ Команда запущена: echo Test && ping -n 3 127.0.0.1 && echo Done
Test

Обмен пакетами с 127.0.0.1 по 32 байт:
Ответ от 127.0.0.1: число байт=32 время<1мс TTL=128
...
Done

✅ Команда завершена (exit: 0)
```

## Базовое использование

### Без аутентификации

```typescript
import { ClientCommunicator } from './ClientCommunicator';

// Создать коммуникатор
const comm = new ClientCommunicator(8080, '0.0.0.0');

// Подписаться на события
comm.on('client:connected', (client) => {
  console.log(`Подключился: ${client.name}`);
});

comm.on('command:stdout', (execId, chunk) => {
  process.stdout.write(chunk); // Потоковый вывод в реальном времени
});

comm.on('command:completed', (result) => {
  console.log(`Готово! Exit code: ${result.exitCode}`);
});

// Запустить сервер
comm.start();

// Выполнить команду
const result = await comm.executeCommand(clientId, 'ping -n 5 google.com');

// Дождаться завершения
const final = await comm.waitForCompletion(result.execId);
console.log(final.stdout); // Полный вывод
```

### С аутентификацией (рекомендуется) 🔐

```typescript
import { ClientCommunicator } from './ClientCommunicator';

// Создать коммуникатор с аутентификацией
const comm = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: true,
    tokens: ['your-secure-token-here']
  }
});

comm.on('client:connected', (client) => {
  if (client.authenticated) {
    console.log(`✅ Authenticated: ${client.name}`);
  } else {
    console.log(`❌ Not authenticated: ${client.name}`);
  }
});

comm.start();
```

**Клиент:**
```bash
API_TOKEN=your-secure-token-here bun client.ts
```

## Основные методы

| Метод | Описание |
|-------|----------|
| `executeCommand(clientId, command, options?)` | Выполнить команду на клиенте |
| `killCommand(clientId, execId)` | Прервать выполнение команды |
| `broadcastCommand(command, options?)` | Отправить команду всем клиентам |
| `waitForCompletion(execId, timeout?)` | Дождаться завершения команды |
| `getClients()` | Получить список клиентов |
| `getRunningExecutions()` | Получить запущенные команды |
| `cleanupExecutions(maxAge?)` | Очистить старые результаты |

## События

| Событие | Когда происходит |
|---------|------------------|
| `client:connected` | Новый клиент подключился |
| `client:disconnected` | Клиент отключился |
| `command:started` | Команда начала выполнение |
| `command:stdout` | Получен chunk stdout (в реальном времени) |
| `command:stderr` | Получен chunk stderr (в реальном времени) |
| `command:completed` | Команда завершена |
| `command:error` | Ошибка выполнения |
| `command:killed` | Команда прервана |
| `command:timeout` | Превышен таймаут |

## Примеры

### Пример 1: Простая команда

```typescript
const result = await comm.executeCommand(clientId, 'echo Hello');
const final = await comm.waitForCompletion(result.execId);
console.log(final.stdout); // "Hello\n"
```

### Пример 2: Команда с таймаутом

```typescript
const result = await comm.executeCommand(
  clientId, 
  'long-running-command',
  { timeout: 30000 } // 30 секунд
);
```

### Пример 3: Прервать команду

```typescript
const running = comm.getRunningExecutions();
if (running.length > 0) {
  await comm.killCommand(running[0].clientId, running[0].execId);
}
```

### Пример 4: Отправить всем

```typescript
const results = await comm.broadcastCommand('git pull');
console.log(`Отправлено ${results.length} клиентам`);

// Дождаться всех
for (const r of results) {
  const final = await comm.waitForCompletion(r.execId);
  console.log(`${final.clientId}: ${final.exitCode}`);
}
```

### Пример 5: Поточный вывод

```typescript
comm.on('command:stdout', (execId, chunk, result) => {
  // Вывод в реальном времени
  console.log(`[${result.clientId}] ${chunk}`);
});

await comm.executeCommand(clientId, 'npm install');
```

## Файлы

- **ClientCommunicator.ts** - Основной класс
- **AuthManager.ts** - Управление аутентификацией 🔐
- **test-communicator.ts** - Простой тест (без auth)
- **test-auth.ts** - Тест с аутентификацией 🔐
- **generate-token.ts** - Генератор токенов 🔑
- **example-usage.ts** - Расширенные примеры
- **CLIENT_COMMUNICATOR_README.md** - Полная документация
- **AUTH_README.md** - Документация по аутентификации 🔐
- **AUTH_MIGRATION.md** - Миграция на auth 🔐

## Структура

```
backendServer/
├── ClientCommunicator.ts          # Основной класс ⭐
├── RemoteServer.ts                # WebSocket сервер (используется внутри)
├── client.ts                      # Клиент (запускается отдельно)
├── index.ts                       # Старая точка входа (можно обновить)
├── test-communicator.ts           # Быстрый тест ⭐
├── example-usage.ts               # Подробные примеры
└── CLIENT_COMMUNICATOR_README.md  # Документация
```

## Как это работает

```
┌─────────────────┐
│ ClientCommuni-  │
│    cator        │  ← Высокоуровневый API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RemoteServer   │  ← WebSocket сервер
└────────┬────────┘
         │
    ╔════╧════╗
    ║  WS     ║
    ╚════╤════╝
         │
    ┌────┴────┐
    │ Client  │  ← Удаленный клиент (client.ts)
    └─────────┘
```

## Следующие шаги

1. ✅ Запустить [test-communicator.ts](test-communicator.ts) и [client.ts](client.ts)
2. 📖 Прочитать [CLIENT_COMMUNICATOR_README.md](CLIENT_COMMUNICATOR_README.md) для деталей
3. 💡 Посмотреть [example-usage.ts](example-usage.ts) для продвинутых примеров
4. 🔧 Интегрировать в свой проект

## Поддержка

Все работает через Events, поэтому легко интегрируется с любым кодом:

```typescript
// В Express
app.post('/execute', async (req, res) => {
  const result = await comm.executeCommand(req.body.clientId, req.body.command);
  res.json({ execId: result.execId });
});

// В Socket.io
io.on('connection', (socket) => {
  comm.on('command:stdout', (execId, chunk) => {
    socket.emit('output', { execId, chunk });
  });
});

// В REST API
const result = await comm.executeCommand(clientId, command);
const final = await comm.waitForCompletion(result.execId, 60000);
return final;
```

---

## 🔐 Безопасность

### Зачем нужна аутентификация?

RemoteServer позволяет выполнять произвольные команды на удаленных машинах. **БЕЗ аутентификации любой может подключиться и выполнять команды!**

### Как защититься?

```bash
# 1. Сгенерировать токен
bun generate-token.ts

# 2. Настроить сервер с auth
const comm = new ClientCommunicator({
  authConfig: { required: true, tokens: ['your-token'] }
});

# 3. Клиент должен использовать токен
API_TOKEN=your-token bun client.ts
```

### Рекомендации

✅ **ВСЕГДА** используйте аутентификацию в продакшене  
✅ Используйте длинные токены (32+ байт)  
✅ Храните токены в .env (не коммитите в git!)  
✅ Используйте отдельные токены для каждого клиента  
✅ Регулярно меняйте токены  

❌ НЕ используйте простые пароли как токены  
❌ НЕ передавайте токены в открытом виде  
❌ НЕ коммитите .env в репозиторий  

**Подробнее:** [AUTH_README.md](AUTH_README.md) | [AUTH_MIGRATION.md](AUTH_MIGRATION.md)

---

## 🌐 Web Panel - Управление через браузер

### Что это?

**WebPanel** - веб-интерфейс для управления удаленными клиентами через браузер с полноценными PTY терминалами.

**Возможности:**
- 🖥️ Веб-терминал с xterm.js (как в VS Code, Termius)
- 📊 Dashboard со списком клиентов
- 🔄 Real-time streaming через WebSocket
- 🎨 Современный dark theme UI
- 🔐 Поддержка аутентификации
- 📡 REST API для интеграции

### Быстрый старт

```bash
# Запуск примера с веб-панелью
bun run backendServer/example-web-panel.ts

# В другом терминале запустить клиент
bun run backendServer/client.ts

# Открыть браузер
http://localhost:3000
```

### Создание своего сервера

```typescript
import { RemoteServer } from './RemoteServer';
import { ClientCommunicator } from './ClientCommunicator';
import { WebPanel } from './WebPanel';

// 1. Создать сервер для клиентов
const server = new RemoteServer({ port: 8080 });

// 2. Создать коммуникатор
const communicator = new ClientCommunicator(server);

// 3. Создать веб-панель
const webPanel = new WebPanel(communicator, server, {
  port: 3000,           // Порт для браузера
  publicPath: './public', // Путь к HTML/CSS/JS
  enableAuth: true      // Включить аутентификацию
});

// 4. Запустить все
await server.start();
await webPanel.start();

console.log('Open http://localhost:3000');
```

### Использование терминала

1. Открываем dashboard: `http://localhost:3000`
2. Видим список подключенных клиентов
3. Нажимаем "Open Terminal" на нужном клиенте
4. Получаем полноценный терминал с:
   - Интерактивными приложениями (vim, nano, htop)
   - Яркими цветами (ANSI escape codes)
   - Автоматическим resize
   - Копированием/вставкой

### REST API

```bash
# Получить список клиентов
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/clients

# Выполнить команду через API
curl -X POST http://localhost:3000/api/clients/CLIENT_ID/execute \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "echo Hello", "timeout": 30000}'

# Health check
curl http://localhost:3000/api/health
```

### WebSocket Protocol

```javascript
// Подключение к терминалу через WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

// Аутентификация
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-token'
}));

// Создание терминальной сессии
ws.send(JSON.stringify({
  type: 'terminal:create',
  clientId: 'client-123',
  cols: 80,
  rows: 24
}));

// Отправка ввода
ws.send(JSON.stringify({
  type: 'terminal:input',
  sessionId: 'session-id',
  data: 'ls -la\n'
}));

// Получение вывода
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'terminal:output') {
    console.log(msg.data);
  }
};
```

### Файлы

- **WebPanel.ts** - Сервер веб-панели ⭐
- **TerminalSessionManager.ts** - Управление PTY сессиями
- **terminal-handler.ts** - PTY обработчик на клиенте
- **example-web-panel.ts** - Пример использования ⭐
- **public/dashboard.html** - Главная страница
- **public/terminal.html** - Страница терминала с xterm.js
- **public/styles.css** - Стили UI
- **WEB_PANEL_README.md** - Полная документация ⭐

### Архитектура

```
┌──────────────┐
│   Browser    │  ← Веб UI (xterm.js)
└──────┬───────┘
       │ HTTP/WS
       ▼
┌──────────────┐
│  WebPanel    │  ← Express + WebSocket сервер
│  (port 3000) │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ TerminalSession  │  ← Управление PTY сессиями
│     Manager      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  RemoteServer    │  ← WebSocket для клиентов
│   (port 8080)    │
└──────┬───────────┘
       │ WS
       ▼
┌──────────────────┐
│     Client       │  ← Удаленная машина
│ (terminal-       │
│  handler + PTY)  │
└──────────────────┘
```

### Production deployment

```nginx
# nginx config для HTTPS/WSS
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

**Подробнее:** [WEB_PANEL_README.md](WEB_PANEL_README.md)

---

**Документация на английском в коде, для вас в чате на русском! 🎯**
