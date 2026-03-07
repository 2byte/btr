# RemoteServer - WebSocket Server

Полнофункциональный WebSocket сервер на Bun для управления удалёнными клиентами.

## Возможности

- ✅ **WebSocket соединение** - двусторонняя коммуникация в реальном времени
- ✅ **Управление клиентами** - регистрация, отслеживание и управление подключением
- ✅ **Отправка команд** - выполнение команд shell на удалённых клиентах
- ✅ **Broadcast сообщения** - отправка сообщений всем клиентам
- ✅ **Health checks** - периодическая проверка живучести (ping/pong)
- ✅ **HTTP REST API** - endpoint для получения статуса сервера
- ✅ **Обработчики сообщений** - регистрируемые обработчики для разных типов сообщений
- ✅ **Автоматическое переподключение** - клиент автоматически переподключается при разрыве

## Структура проекта

```
backendServer/
├── remoteServer.ts      # Основной класс WebSocket сервера
├── index.ts            # Точка входа и инициализация
├── client.ts           # WebSocket клиент (для тестирования)
├── Server.ts           # Класс базового HTTP сервера
└── README.md          # Данная документация
```

## Типы сообщений

### От клиента к серверу

- **hello** - представление клиента (имя, ОС, архитектура)
- **command** - (только сервер отправляет)
- **result** - результат выполненной команды (stdout, stderr, exitCode)
- **error** - ошибка на клиенте
- **pong** - ответ на ping сервера
- **status** - отправка статуса клиента (uptime, memory)

### От сервера к клиенту

- **welcome** - приветствие при подключении (clientId)
- **command** - команда для выполнения
- **ping** - проверка живучести
- **broadcast** - сообщение для всех клиентов
- **error** - ошибка сервера

## Запуск сервера

### Базовый запуск

```bash
cd backendServer
bun index.ts
```

Сервер запустится на `ws://0.0.0.0:8080`

### С переменными окружения

```bash
REMOTE_SERVER_PORT=9000 REMOTE_SERVER_HOST=localhost bun index.ts
```

### В фоне (Windows)

```vbs
' Создать файл start_server.vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "bun index.ts", 0, False
```

## Использование сервера в коде

### Инициализация

```typescript
import { RemoteServer } from './remoteServer';

const server = new RemoteServer(8080, '0.0.0.0');
server.start();
```

### Регистрация обработчиков сообщений

```typescript
// Обработчик результатов команд
server.on('result', (ws, msg) => {
  console.log(`Результат: ${msg.command}`);
  console.log(`Stdout: ${msg.stdout}`);
  console.log(`Exit Code: ${msg.exitCode}`);
});

// Обработчик ошибок
server.on('error', (ws, msg) => {
  console.error(`Ошибка: ${msg.message}`);
});
```

### Отправка команд

```typescript
// Отправить команду конкретному клиенту
server.sendCommandToClient('client-id', 'echo Hello');

// Broadcast всем клиентам
server.broadcast({
  type: 'broadcast',
  message: 'Привет всем!'
});

// Проверка живучести
server.healthCheck();
```

### Получение информации о клиентах

```typescript
// Все клиенты
const clients = server.getClients();

// Конкретный клиент
const client = server.getClient('client-id');

// Количество подключённых
const count = server.getClientCount();
```

## REST API

### Получить статус сервера

```bash
curl http://localhost:8080/status
```

Ответ:
```json
{
  "status": "running",
  "connectedClients": 2,
  "clients": [
    {
      "id": "abc12345",
      "name": "remote-win32-xyz789",
      "connectedAt": "2026-02-07T10:30:00.000Z"
    }
  ]
}
```

## Запуск клиента для тестирования

### Via Bun

```bash
WS_URL=ws://127.0.0.1:8080 bun client.ts
```

### Via Node.js

```bash
WS_URL=ws://127.0.0.1:8080 node client.ts
```

## Жизненный цикл сообщения

1. **Подключение**
   ```
   Client → Server: WebSocket upgrade
   Server → Client: welcome {clientId, message}
   ```

2. **Представление**
   ```
   Client → Server: hello {name, os, arch}
   Server: сохраняет информацию клиента
   ```

3. **Отправка команды**
   ```
   Server → Client: command {command}
   Client: выполняет команду в shell
   Client → Server: result {stdout, stderr, exitCode}
   ```

4. **Health Check**
   ```
   Server → Client: ping
   Client → Server: pong
   Server: обновляет lastPing клиента
   ```

## Архитектура клиента

[client.ts](client.ts) реализует:

- Автоматическое переподключение с экспоненциальной задержкой
- Выполнение shell команд (cmd.exe на Windows, bash на Linux/Mac)
- Отправку результатов на сервер
- Периодическое отправление статуса
- Обработку разных типов сообщений от сервера

## Конфигурация

### Переменные окружения

| Переменная | Умолчание | Описание |
|-----------|-----------|---------|
| `REMOTE_SERVER_PORT` | 8080 | Порт WebSocket сервера |
| `REMOTE_SERVER_HOST` | 0.0.0.0 | Хост для прослушивания |
| `WS_URL` | ws://127.0.0.1:8080 | URL сервера для клиента |
| `MAX_RECONNECT_ATTEMPTS` | -1 | Максимум попыток переподключения (-1 = бесконечно) |

## Примеры использования

### Пример 1: Отправка команды через 10 секунд после старта

```typescript
setTimeout(() => {
  const clients = server.getClients();
  if (clients.length > 0) {
    server.sendCommandToClient(clients[0].clientId, 'dir');
  }
}, 10000);
```

### Пример 2: Отправить команду всем клиентам

```typescript
function sendToAll(command: string) {
  for (const client of server.getClients()) {
    server.sendCommandToClient(client.clientId, command);
  }
}
```

### Пример 3: Обработать результаты выполнения

```typescript
server.on('result', (ws, msg) => {
  const client = ws.data;
  
  // Сохранить результат в БД
  await db.results.create({
    clientId: client?.clientId,
    command: msg.command,
    stdout: msg.stdout,
    stderr: msg.stderr,
    exitCode: msg.exitCode,
    timestamp: new Date()
  });
});
```

## Безопасность

⚠️ **Важно**: Этот сервер не интегрирует аутентификацию и шифрование по умолчанию.

Для production используйте:

- **WSS (WebSocket Secure)** вместо WS
- **SSL/TLS сертификаты** (например, Let's Encrypt)
- **Аутентификация** клиентов (tokens, API keys)
- **Авторизацию** команд (whitelist)
- **Rate limiting** для защиты от DoS
- **Логирование и мониторинг** всех операций

## Отладка

### Включить детальное логирование

```typescript
process.env.DEBUG = '1';
```

### Проверить соединение

```bash
# Windows PowerShell
Test-NetConnection -ComputerName 127.0.0.1 -Port 8080

# Linux/Mac
netstat -an | grep 8080
# или
lsof -i :8080
```

### Использовать WebSocket клиент для тестирования

```bash
# Установить wscat
npm install -g wscat

# Подключиться
wscat -c ws://localhost:8080
```

## Производительность

- **Одновременные соединения**: ограничены ресурсами сервера (обычно 1000+)
- **Throughput**: зависит от размера сообщений и пропускной способности сети
- **Latency**: обычно < 100ms для местной сети

## 🚀 Новые возможности

### ClientCommunicator - High-level API

Высокоуровневый API для управления клиентами с удобными методами:

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const comm = new ClientCommunicator(server);

// Выполнить команду с потоковым выводом
const result = await comm.executeCommand(clientId, 'npm install');

// Подписаться на real-time вывод
comm.on('command:stdout', (execId, chunk) => {
  process.stdout.write(chunk);
});

// Дождаться завершения
const final = await comm.waitForCompletion(result.execId);
console.log(`Exit code: ${final.exitCode}`);
```

**Подробнее**: [CLIENT_COMMUNICATOR_README.md](CLIENT_COMMUNICATOR_README.md)

### WebPanel - Управление через браузер

Веб-интерфейс с полноценными PTY терминалами:

```typescript
import { WebPanel } from './WebPanel';

const webPanel = new WebPanel(communicator, server, {
  port: 3000,
  enableAuth: true
});

await webPanel.start();
console.log('Open http://localhost:3000');
```

**Возможности:**
- 🖥️ Веб-терминал с xterm.js (как в VS Code, Termius)
- 📊 Dashboard со списком клиентов
- 🔄 Real-time streaming через WebSocket
- 📡 REST API для интеграции
- 🎨 Современный dark theme UI

**Подробнее**: [WEB_PANEL_README.md](WEB_PANEL_README.md)

### Authentication - Безопасность

Полноценная система аутентификации на основе токенов:

```typescript
// Сервер с аутентификацией
const server = new RemoteServer({
  port: 8080,
  enableAuth: true,
  tokens: ['client-token']
});

// Клиент с токеном
API_TOKEN=client-token bun client.ts
```

**Генерация токенов:**
```bash
bun run backendServer/generate-token.ts --name "client-1"
```

**Подробнее**: [AUTH_README.md](AUTH_README.md)

## 📚 Документация

| Документ | Описание |
|----------|----------|
| [QUICKSTART.md](QUICKSTART.md) | Быстрый старт за 30 секунд ⭐ |
| [CLIENT_COMMUNICATOR_README.md](CLIENT_COMMUNICATOR_README.md) | ClientCommunicator API |
| [WEB_PANEL_README.md](WEB_PANEL_README.md) | Web Panel с терминалами |
| [AUTH_README.md](AUTH_README.md) | Аутентификация и безопасность |
| [AUTH_MIGRATION.md](AUTH_MIGRATION.md) | Миграция на auth |
| [AUTH_SUMMARY.md](AUTH_SUMMARY.md) | Краткая сводка по auth |

## 🎯 Примеры

| Файл | Описание |
|------|----------|
| [example-usage.ts](example-usage.ts) | Примеры ClientCommunicator |
| [example-web-panel.ts](example-web-panel.ts) | Пример веб-панели ⭐ |
| [test-communicator.ts](test-communicator.ts) | Быстрый тест ⭐ |
| [test-auth.ts](test-auth.ts) | Тест аутентификации |
| [generate-token.ts](generate-token.ts) | Генератор токенов |

## Лицензия

MIT (или другое)

## Поддержка

Для вопросов и issues создавайте pull requests или issues в репозитории проекта.
