# Аутентификация в RemoteServer

## Описание

Система аутентификации на основе API токенов для защиты RemoteServer от несанкционированного доступа. Клиенты должны предоставить валидный токен при подключении.

## Быстрый старт

### 1. Генерация токенов

```bash
# Сгенерировать один токен
bun generate-token.ts

# Сгенерировать 5 токенов
bun generate-token.ts --count 5

# Сгенерировать длинный токен (64 байта)
bun generate-token.ts --length 64
```

Вывод:
```
🔑 Generating 1 token(s)...

Token 1: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

📝 Usage:

Add to your .env file:

API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 2. Настройка сервера

#### С аутентификацией (рекомендуется)

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const communicator = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: true, // Требовать аутентификацию
    tokens: [
      'your-secure-token-here',
      'another-token-for-different-client'
    ]
  }
});

communicator.start();
```

#### Без аутентификации (для тестирования)

```typescript
const communicator = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: false // Аутентификация не требуется
  }
});
```

#### Загрузка токенов из переменных окружения

**.env файл:**
```env
API_TOKENS=token1,token2,token3
```

**Код:**
```typescript
const communicator = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: true,
    tokens: [] // Пустой массив
  }
});

// Загрузить токены из переменной окружения
const authManager = communicator.getAuthManager();
const loaded = authManager.loadFromEnv('API_TOKENS');
console.log(`Загружено токенов: ${loaded}`);

communicator.start();
```

### 3. Настройка клиента

**Через переменную окружения:**

```bash
API_TOKEN=your-token-here bun client.ts
```

**Через .env файл:**

```env
WS_URL=ws://localhost:8080
API_TOKEN=your-secure-token-here
```

Затем:
```bash
bun client.ts
```

## Как это работает

### 1. Подключение клиента

```
Client                          Server
  |                               |
  |------ WebSocket Connect ----->|
  |                               |
  |<----- Welcome message --------|
  |     (authRequired: true)      |
  |                               |
  |------ Hello + Token --------->|
  |                               |
  |                          [Validate token]
  |                               |
  |<---- Connection accepted -----|
  |    (if token valid)           |
  |                               |
  |      OR                       |
  |                               |
  |<---- Error + Disconnect ------|
  |    (if token invalid)         |
```

### 2. Проверка токена

При получении сообщения `hello` от клиента, сервер:

1. Проверяет, требуется ли аутентификация
2. Извлекает токен из сообщения
3. Валидирует токен через `AuthManager`
4. Если токен валиден:
   - Помечает клиента как authenticated
   - Разрешает выполнение команд
5. Если токен невалиден:
   - Отправляет ошибку клиенту
   - Закрывает соединение

### 3. Выполнение команд

Только аутентифицированные клиенты могут получать и выполнять команды. При попытке отправить команду неавторизованному клиенту, сервер вернет `false`.

## API

### AuthManager

#### Создание

```typescript
import { AuthManager } from './AuthManager';

const authManager = new AuthManager({
  required: true,
  tokens: ['token1', 'token2'],
  tokenMetadata: new Map([
    ['token1', {
      name: 'Production Token',
      createdAt: new Date(),
      expiresAt: new Date('2027-01-01')
    }]
  ])
});
```

#### Методы

##### validateToken(token)

Проверяет валидность токена.

```typescript
if (authManager.validateToken('some-token')) {
  console.log('Token is valid');
} else {
  console.log('Token is invalid');
}
```

##### addToken(token, metadata?)

Добавляет новый токен.

```typescript
authManager.addToken('new-token', {
  name: 'New Client Token',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000) // Expires in 24 hours
});
```

##### removeToken(token)

Удаляет токен.

```typescript
const removed = authManager.removeToken('old-token');
console.log(`Token removed: ${removed}`);
```

##### loadFromEnv(envVar)

Загружает токены из переменной окружения.

```typescript
// .env: API_TOKENS=token1,token2,token3
const count = authManager.loadFromEnv('API_TOKENS');
console.log(`Loaded ${count} tokens`);
```

##### generateToken(length)

Генерирует простой случайный токен (alphanumeric).

```typescript
const token = AuthManager.generateToken(32);
// Пример: "aB3dEf9hIjK1mNoPqR5tUvWx2z4A6C8E"
```

##### generateSecureToken(length)

Генерирует криптографически стойкий токен (hex).

```typescript
const token = AuthManager.generateSecureToken(32);
// Пример: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
```

##### getTokenCount()

Возвращает количество активных токенов.

```typescript
console.log(`Active tokens: ${authManager.getTokenCount()}`);
```

##### isAuthRequired()

Проверяет, требуется ли аутентификация.

```typescript
if (authManager.isAuthRequired()) {
  console.log('Auth is required');
}
```

##### setAuthRequired(required)

Включает/выключает требование аутентификации.

```typescript
authManager.setAuthRequired(false); // Disable auth
authManager.setAuthRequired(true);  // Enable auth
```

### ClientCommunicator

#### getAuthManager()

Получить экземпляр AuthManager.

```typescript
const authManager = communicator.getAuthManager();
console.log(`Tokens: ${authManager.getTokenCount()}`);
```

#### getAuthenticatedClientCount()

Получить количество аутентифицированных клиентов.

```typescript
const authenticated = communicator.getAuthenticatedClientCount();
const total = communicator.getClientCount();
console.log(`Authenticated: ${authenticated}/${total}`);
```

### ClientData

При получении информации о клиенте, доступны поля:

```typescript
interface ClientData {
  clientId: string;
  name?: string;
  os?: string;
  arch?: string;
  connectedAt: Date;
  lastPing?: Date;
  authenticated: boolean; // ✨ Новое поле
  token?: string;         // ✨ Новое поле (если аутентифицирован)
}
```

Пример:
```typescript
const clients = communicator.getClients();
clients.forEach(client => {
  console.log(`${client.name}: ${client.authenticated ? '🔓' : '🔒'}`);
});
```

## Примеры использования

### Пример 1: Базовая аутентификация

**Сервер (server.ts):**
```typescript
import { ClientCommunicator } from './ClientCommunicator';

const TOKEN = 'my-secret-token-123';

const comm = new ClientCommunicator({
  port: 8080,
  authConfig: {
    required: true,
    tokens: [TOKEN]
  }
});

comm.on('client:connected', (client) => {
  if (client.authenticated) {
    console.log(`✅ Authenticated client: ${client.name}`);
  }
});

comm.start();
console.log(`Server started. Use token: ${TOKEN}`);
```

**Клиент:**
```bash
API_TOKEN=my-secret-token-123 bun client.ts
```

### Пример 2: Несколько токенов

```typescript
const comm = new ClientCommunicator({
  port: 8080,
  authConfig: {
    required: true,
    tokens: [
      'admin-token-xxx',
      'client1-token-yyy',
      'client2-token-zzz'
    ]
  }
});
```

### Пример 3: Временные токены

```typescript
import { ClientCommunicator } from './ClientCommunicator';
import { AuthManager } from './AuthManager';

const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: true, tokens: [] }
});

const authManager = comm.getAuthManager();

// Создать временный токен на 1 час
const tempToken = AuthManager.generateSecureToken(32);
authManager.addToken(tempToken, {
  name: 'Temporary Token',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000) // 1 hour
});

console.log(`Temporary token (valid for 1 hour): ${tempToken}`);

comm.start();
```

### Пример 4: Управление токенами в runtime

```typescript
const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: true, tokens: [] }
});

const authManager = comm.getAuthManager();

// HTTP endpoint для создания токена
app.post('/token/create', (req, res) => {
  const token = AuthManager.generateSecureToken(32);
  
  authManager.addToken(token, {
    name: req.body.name || 'Generated Token',
    createdAt: new Date()
  });
  
  res.json({ token });
});

// HTTP endpoint для удаления токена
app.post('/token/revoke', (req, res) => {
  const removed = authManager.removeToken(req.body.token);
  res.json({ success: removed });
});
```

### Пример 5: Миграция с открытого на закрытый режим

```typescript
// Начинаем без аутентификации
const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: false }
});

comm.start();

// Позже включаем аутентификацию
setTimeout(() => {
  const authManager = comm.getAuthManager();
  
  // Добавляем токены
  authManager.addToken('secure-token-1');
  authManager.addToken('secure-token-2');
  
  // Включаем требование аутентификации
  authManager.setAuthRequired(true);
  
  console.log('🔐 Authentication is now required');
  
  // Существующие неаутентифицированные клиенты продолжат работать
  // Новые клиенты должны будут предоставить токен
}, 60000); // Через 1 минуту
```

### Пример 6: Мониторинг аутентификации

```typescript
const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: true, tokens: ['token123'] }
});

// Отслеживаем попытки подключения
comm.on('client:connected', (client) => {
  const status = client.authenticated ? '✅ Authenticated' : '❌ Not authenticated';
  console.log(`Client ${client.name}: ${status}`);
  
  // Логирование для безопасности
  if (!client.authenticated) {
    console.warn(`⚠️ Unauthenticated connection attempt from ${client.clientId}`);
  }
});

// Периодический отчет
setInterval(() => {
  const total = comm.getClientCount();
  const authenticated = comm.getAuthenticatedClientCount();
  const unauthenticated = total - authenticated;
  
  console.log(`\n📊 Security Status:`);
  console.log(`   Authenticated clients: ${authenticated}`);
  console.log(`   Unauthenticated clients: ${unauthenticated}`);
  
  if (unauthenticated > 0) {
    console.warn(`   ⚠️ Warning: ${unauthenticated} clients are not authenticated!`);
  }
}, 60000);
```

## Тестирование

### Тест с аутентификацией

```bash
# Сгенерировать токен
bun generate-token.ts

# Запустить сервер с аутентификацией
bun test-auth.ts

# В другом терминале - запустить клиент с токеном
API_TOKEN=your-token-here bun client.ts
```

### Тест без токена (должен быть отклонен)

```bash
# Запустить клиент без токена
bun client.ts
# Ожидается: соединение будет закрыто с ошибкой "Authentication failed"
```

## Безопасность

### Рекомендации

1. **Используйте длинные токены**: Минимум 32 байта (64 символа в hex)
2. **Используйте `generateSecureToken()`**: Криптографически стойкая генерация
3. **Храните токены в .env**: Не коммитьте токены в git
4. **Используйте HTTPS/WSS**: В продакшене используйте защищенное соединение
5. **Ротация токенов**: Регулярно меняйте токены
6. **Мониторинг**: Отслеживайте неудачные попытки аутентификации
7. **Временные токены**: Устанавливайте срок действия для токенов

### Хранение токенов

**.env (не коммитить!):**
```env
API_TOKENS=token1,token2,token3
```

**.gitignore:**
```
.env
.env.local
*.token
```

**Безопасная передача:**
- Используйте зашифрованные каналы для передачи токенов
- Не отправляйте токены по email или в открытом виде
- Используйте password managers для хранения

## Troubleshooting

### Клиент не может подключиться

**Проблема:** Клиент отключается сразу после подключения.

**Решение:**
1. Проверьте, что токен установлен: `echo $API_TOKEN`
2. Проверьте, что токен есть на сервере
3. Проверьте логи сервера на наличие ошибок аутентификации

### Токен не работает

**Проблема:** Сервер отклоняет валидный токен.

**Решение:**
1. Проверьте точное совпадение токена (нет пробелов, правильный регистр)
2. Проверьте, не истек ли срок действия токена
3. Проверьте, загружены ли токены на сервере:
```typescript
console.log(`Tokens: ${authManager.getTokenCount()}`);
console.log(`Tokens list:`, authManager.getTokens());
```

### Аутентификация отключена

**Проблема:** Все клиенты подключаются без токена.

**Решение:**
Проверьте конфигурацию:
```typescript
const authManager = communicator.getAuthManager();
console.log(`Auth required: ${authManager.isAuthRequired()}`);
// Должно быть true
```

Включите аутентификацию:
```typescript
authManager.setAuthRequired(true);
```

## Дополнительные возможности

### Интеграция с базой данных

```typescript
import { ClientCommunicator } from './ClientCommunicator';
import { db } from './database';

const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: true, tokens: [] }
});

// Загрузить токены из БД
const authManager = comm.getAuthManager();
const tokens = await db.tokens.findAll();

tokens.forEach(tokenData => {
  authManager.addToken(tokenData.token, {
    name: tokenData.name,
    createdAt: new Date(tokenData.createdAt),
    expiresAt: tokenData.expiresAt ? new Date(tokenData.expiresAt) : undefined
  });
});

comm.start();
```

### Логирование попыток входа

```typescript
comm.on('client:connected', (client) => {
  // Сохранить в лог
  logger.info({
    event: 'client_connected',
    clientId: client.clientId,
    name: client.name,
    authenticated: client.authenticated,
    timestamp: new Date()
  });
});

comm.on('client:disconnected', (clientId) => {
  logger.info({
    event: 'client_disconnected',
    clientId,
    timestamp: new Date()
  });
});
```

## См. также

- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт
- [CLIENT_COMMUNICATOR_README.md](CLIENT_COMMUNICATOR_README.md) - Полная документация API
- [generate-token.ts](generate-token.ts) - Генератор токенов
- [test-auth.ts](test-auth.ts) - Пример с аутентификацией
