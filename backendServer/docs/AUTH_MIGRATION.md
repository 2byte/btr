# Миграция на аутентификацию - Краткая инструкция

## Для существующих проектов

Если у вас уже работает RemoteServer без аутентификации, вот как добавить защиту:

## Шаг 1: Сгенерировать токен

```bash
cd backendServer
bun generate-token.ts
```

Вывод:
```
🔑 Generating 1 token(s)...

Token 1: a1b2c3d4e5f6...xyz

📝 Usage:
Add to your .env file:
API_TOKEN=a1b2c3d4e5f6...xyz
```

## Шаг 2: Добавить токен в .env

```bash
echo "API_TOKEN=a1b2c3d4e5f6...xyz" >> .env
```

## Шаг 3: Обновить код сервера

### Было (без аутентификации):

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const comm = new ClientCommunicator(8080, '0.0.0.0');
comm.start();
```

### Стало (с аутентификацией):

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const comm = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: true,
    tokens: [process.env.API_TOKEN || '']
  }
});

comm.start();
```

Или загрузить токены автоматически:

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const comm = new ClientCommunicator({
  port: 8080,
  hostname: '0.0.0.0',
  authConfig: {
    required: true,
    tokens: [] // Пустой массив
  }
});

// Загрузить из .env
const authManager = comm.getAuthManager();
authManager.loadFromEnv('API_TOKEN'); // или 'API_TOKENS' для нескольких

comm.start();
```

## Шаг 4: Обновить запуск клиента

### Было:

```bash
bun client.ts
```

### Стало:

```bash
API_TOKEN=a1b2c3d4e5f6...xyz bun client.ts
```

Или добавить в .env клиента:

```env
# .env
WS_URL=ws://localhost:8080
API_TOKEN=a1b2c3d4e5f6...xyz
```

Тогда просто:
```bash
bun client.ts
```

## Готово! 🎉

Теперь ваш сервер защищен аутентификацией. Только клиенты с валидным токеном смогут подключиться.

## Дополнительно: Несколько клиентов

Если нужно подключить несколько клиентов:

### 1. Сгенерировать несколько токенов:

```bash
bun generate-token.ts --count 3
```

### 2. Добавить в .env сервера:

```env
API_TOKENS=token1,token2,token3
```

### 3. Загрузить в сервер:

```typescript
const authManager = comm.getAuthManager();
authManager.loadFromEnv('API_TOKENS');
```

### 4. Запустить клиентов с разными токенами:

```bash
# Terminal 1
API_TOKEN=token1 bun client.ts

# Terminal 2
API_TOKEN=token2 bun client.ts

# Terminal 3
API_TOKEN=token3 bun client.ts
```

## Плавная миграция

Если нужно мигрировать без остановки сервиса:

```typescript
// Запустить БЕЗ требования аутентификации
const comm = new ClientCommunicator({
  port: 8080,
  authConfig: { required: false } // Пока не требуем
});

comm.start();

// Добавить токены
const authManager = comm.getAuthManager();
authManager.addToken('token1');
authManager.addToken('token2');

// Позже включить требование (через 1 час, например)
setTimeout(() => {
  authManager.setAuthRequired(true);
  console.log('🔐 Auth is now required!');
}, 3600000);
```

## Проверка

### Проверить, что работает:

```bash
# С токеном - должно работать
API_TOKEN=your-token bun client.ts
# ✅ Client connected

# Без токена - должно отклоняться
bun client.ts
# ❌ Authentication failed
```

### Мониторинг:

```typescript
setInterval(() => {
  const total = comm.getClientCount();
  const auth = comm.getAuthenticatedClientCount();
  console.log(`Clients: ${auth}/${total} authenticated`);
}, 10000);
```

## Troubleshooting

❌ **Клиент не подключается**
- Проверьте токен: `echo $API_TOKEN`
- Проверьте логи сервера
- Убедитесь что токен добавлен на сервере

❌ **Все еще подключаются без токена**
- Проверьте `authConfig.required: true`
- Проверьте что токены загружены: `authManager.getTokenCount()`

## См. также

- [AUTH_README.md](AUTH_README.md) - Полная документация по аутентификации
- [generate-token.ts](generate-token.ts) - Генератор токенов
- [test-auth.ts](test-auth.ts) - Пример с аутентификацией
