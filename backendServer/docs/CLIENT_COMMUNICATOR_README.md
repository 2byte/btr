# ClientCommunicator - Управление удаленными клиентами

## Описание

`ClientCommunicator` - это высокоуровневый класс для управления WebSocket клиентами и выполнения команд на них с поддержкой потокового вывода в реальном времени.

## Основные возможности

- ✅ Подключение и управление несколькими клиентами
- ✅ Выполнение команд с потоковым выводом (stdout/stderr)
- ✅ Отслеживание статуса выполнения команд
- ✅ Прерывание запущенных команд
- ✅ Broadcast команд на все клиенты
- ✅ Таймауты для команд
- ✅ Event-based архитектура для обработки событий
- ✅ Автоматическая очистка старых результатов

## Быстрый старт

### 1. Запуск сервера

```typescript
import { ClientCommunicator } from './ClientCommunicator';

const communicator = new ClientCommunicator(8080, '0.0.0.0');
communicator.start();
```

### 2. Подписка на события

```typescript
// Новый клиент подключился
communicator.on('client:connected', (client) => {
  console.log(`Подключился клиент: ${client.clientId} (${client.name})`);
});

// Клиент отключился
communicator.on('client:disconnected', (clientId) => {
  console.log(`Отключился клиент: ${clientId}`);
});

// Команда начала выполнение
communicator.on('command:started', (result) => {
  console.log(`Команда запущена: ${result.command}`);
});

// Получен stdout в реальном времени
communicator.on('command:stdout', (execId, chunk, result) => {
  process.stdout.write(chunk); // Вывод в консоль в реальном времени
});

// Получен stderr в реальном времени
communicator.on('command:stderr', (execId, chunk, result) => {
  process.stderr.write(chunk);
});

// Команда завершена
communicator.on('command:completed', (result) => {
  console.log(`Команда завершена с кодом: ${result.exitCode}`);
  console.log(`Полный stdout: ${result.stdout}`);
  console.log(`Полный stderr: ${result.stderr}`);
});

// Ошибка выполнения
communicator.on('command:error', (execId, error, result) => {
  console.error(`Ошибка: ${error}`);
});

// Команда прервана
communicator.on('command:killed', (result) => {
  console.log(`Команда ${result.execId} была прервана`);
});

// Таймаут команды
communicator.on('command:timeout', (result) => {
  console.log(`Команда ${result.execId} превысила таймаут`);
});
```

### 3. Выполнение команд

#### Простое выполнение

```typescript
const clients = communicator.getClients();
const client = clients[0];

// Отправить команду
const result = await communicator.executeCommand(
  client.clientId,
  'ping -n 10 google.com'
);

console.log(`Команда отправлена, ID: ${result.execId}`);
```

#### С таймаутом

```typescript
const result = await communicator.executeCommand(
  client.clientId,
  'long-running-command',
  {
    timeout: 30000 // 30 секунд
  }
);
```

#### С пользовательским execId

```typescript
const result = await communicator.executeCommand(
  client.clientId,
  'my-command',
  {
    execId: 'my-custom-id-123'
  }
);
```

#### Дождаться завершения

```typescript
const result = await communicator.executeCommand(
  client.clientId,
  'ping -n 5 127.0.0.1'
);

// Дождаться завершения (максимум 60 секунд)
const finalResult = await communicator.waitForCompletion(result.execId, 60000);

console.log(`Exit code: ${finalResult.exitCode}`);
console.log(`Stdout: ${finalResult.stdout}`);
console.log(`Stderr: ${finalResult.stderr}`);
```

### 4. Прерывание команд

```typescript
// Получить запущенные команды
const running = communicator.getRunningExecutions();

if (running.length > 0) {
  const toKill = running[0];
  
  // Прервать команду
  await communicator.killCommand(toKill.clientId, toKill.execId);
  
  console.log(`Команда ${toKill.execId} остановлена`);
}
```

### 5. Broadcast команд

```typescript
// Отправить команду всем подключенным клиентам
const results = await communicator.broadcastCommand('echo Hello from server!');

console.log(`Команда отправлена ${results.length} клиентам`);

// Дождаться завершения всех команд
for (const result of results) {
  const finalResult = await communicator.waitForCompletion(result.execId);
  console.log(`Клиент ${finalResult.clientId}: ${finalResult.stdout}`);
}
```

### 6. Управление клиентами

```typescript
// Получить всех клиентов
const clients = communicator.getClients();
console.log(`Подключено клиентов: ${clients.length}`);

// Получить конкретного клиента
const client = communicator.getClient('client-id-123');
if (client) {
  console.log(`Клиент: ${client.name}, OS: ${client.os}`);
}

// Найти клиентов по имени
const windowsClients = communicator.findClientsByName(/windows/i);
console.log(`Найдено Windows клиентов: ${windowsClients.length}`);

// Количество клиентов
const count = communicator.getClientCount();
console.log(`Всего клиентов: ${count}`);
```

### 7. Отслеживание выполнения команд

```typescript
// Получить информацию о выполнении
const execution = communicator.getExecution('exec-id-123');
if (execution) {
  console.log(`Статус: ${execution.status}`);
  console.log(`Команда: ${execution.command}`);
  console.log(`Stdout: ${execution.stdout}`);
  console.log(`Stderr: ${execution.stderr}`);
}

// Получить все команды клиента
const clientExecutions = communicator.getClientExecutions('client-id-123');
console.log(`Клиент выполнил ${clientExecutions.length} команд`);

// Получить запущенные команды
const running = communicator.getRunningExecutions();
console.log(`Сейчас выполняется ${running.length} команд`);
```

### 8. Очистка старых результатов

```typescript
// Удалить результаты старше 1 часа
const cleaned = communicator.cleanupExecutions(3600000);
console.log(`Удалено ${cleaned} старых результатов`);

// Автоматическая очистка каждый час
setInterval(() => {
  communicator.cleanupExecutions(3600000);
}, 3600000);
```

### 9. Health Check

```typescript
// Проверить доступность клиентов
communicator.healthCheck();

// Периодический health check
setInterval(() => {
  communicator.healthCheck();
}, 30000); // Каждые 30 секунд
```

## API Reference

### Класс ClientCommunicator

#### Constructor

```typescript
constructor(port: number = 8080, hostname: string = '0.0.0.0')
```

Создает новый экземпляр ClientCommunicator.

#### Методы

##### start()

```typescript
public start(): void
```

Запускает WebSocket сервер.

##### stop()

```typescript
public stop(): void
```

Останавливает сервер и очищает все ресурсы.

##### executeCommand()

```typescript
public async executeCommand(
  clientId: string,
  command: string,
  options?: CommandOptions
): Promise<CommandResult>
```

Выполняет команду на указанном клиенте.

**Параметры:**
- `clientId` - ID целевого клиента
- `command` - Команда для выполнения
- `options` - Опции выполнения
  - `execId?: string` - Пользовательский ID выполнения
  - `timeout?: number` - Таймаут в миллисекундах

**Возвращает:** Promise с объектом CommandResult

##### killCommand()

```typescript
public async killCommand(clientId: string, execId: string): Promise<void>
```

Прерывает выполняемую команду.

##### waitForCompletion()

```typescript
public async waitForCompletion(execId: string, timeout?: number): Promise<CommandResult>
```

Ожидает завершения команды.

##### broadcastCommand()

```typescript
public async broadcastCommand(
  command: string,
  options?: CommandOptions
): Promise<CommandResult[]>
```

Отправляет команду всем подключенным клиентам.

##### getClients()

```typescript
public getClients(): ClientData[]
```

Возвращает все подключенные клиенты.

##### getClient()

```typescript
public getClient(clientId: string): ClientData | undefined
```

Возвращает данные конкретного клиента.

##### findClientsByName()

```typescript
public findClientsByName(namePattern: string | RegExp): ClientData[]
```

Находит клиентов по имени.

##### getExecution()

```typescript
public getExecution(execId: string): CommandResult | undefined
```

Возвращает результат выполнения команды.

##### getClientExecutions()

```typescript
public getClientExecutions(clientId: string): CommandResult[]
```

Возвращает все выполнения команд для клиента.

##### getRunningExecutions()

```typescript
public getRunningExecutions(): CommandResult[]
```

Возвращает все запущенные команды.

##### cleanupExecutions()

```typescript
public cleanupExecutions(maxAge?: number): number
```

Удаляет старые завершенные команды.

##### healthCheck()

```typescript
public healthCheck(): void
```

Отправляет ping всем клиентам.

### Интерфейсы

#### CommandResult

```typescript
interface CommandResult {
  execId: string;           // ID выполнения
  clientId: string;         // ID клиента
  command: string;          // Команда
  exitCode?: number;        // Код завершения
  stdout: string;           // Полный stdout
  stderr: string;           // Полный stderr
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout' | 'killed';
  startedAt: Date;          // Время начала
  completedAt?: Date;       // Время завершения
  error?: string;           // Сообщение об ошибке
}
```

#### ClientData

```typescript
interface ClientData {
  clientId: string;         // Уникальный ID клиента
  name?: string;            // Имя клиента
  os?: string;              // Операционная система
  arch?: string;            // Архитектура
  connectedAt: Date;        // Время подключения
  lastPing?: Date;          // Последний ping
}
```

### События

- `client:connected` - Новый клиент подключился
- `client:disconnected` - Клиент отключился
- `command:started` - Команда начала выполнение
- `command:stdout` - Получен chunk stdout
- `command:stderr` - Получен chunk stderr
- `command:completed` - Команда завершена
- `command:error` - Ошибка выполнения
- `command:timeout` - Таймаут команды
- `command:killed` - Команда прервана

## Примеры использования

### Пример 1: Мониторинг системы

```typescript
const communicator = new ClientCommunicator(8080);
communicator.start();

// Периодически получать информацию о системе
setInterval(async () => {
  const clients = communicator.getClients();
  
  for (const client of clients) {
    const command = client.os === 'win32' 
      ? 'systeminfo' 
      : 'uname -a && free -h';
    
    const result = await communicator.executeCommand(client.clientId, command);
    const final = await communicator.waitForCompletion(result.execId);
    
    console.log(`\n=== ${client.name} ===`);
    console.log(final.stdout);
  }
}, 60000); // Каждую минуту
```

### Пример 2: Выполнение скриптов

```typescript
communicator.on('client:connected', async (client) => {
  // Выполнить инициализационный скрипт при подключении
  const script = client.os === 'win32'
    ? 'cd C:\\workspace && git pull'
    : 'cd /workspace && git pull';
  
  const result = await communicator.executeCommand(client.clientId, script);
  const final = await communicator.waitForCompletion(result.execId);
  
  if (final.exitCode === 0) {
    console.log(`✅ Клиент ${client.name} обновлена`);
  } else {
    console.error(`❌ Ошибка обновления ${client.name}: ${final.stderr}`);
  }
});
```

### Пример 3: Массовое обновление

```typescript
async function updateAllClients() {
  const results = await communicator.broadcastCommand('git pull origin main');
  
  console.log(`Обновление отправлено ${results.length} клиентам`);
  
  // Дождаться всех
  const finals = await Promise.all(
    results.map(r => communicator.waitForCompletion(r.execId))
  );
  
  // Сводка
  const success = finals.filter(f => f.exitCode === 0).length;
  const failed = finals.filter(f => f.exitCode !== 0).length;
  
  console.log(`✅ Успешно: ${success}`);
  console.log(`❌ Ошибок: ${failed}`);
}
```

### Пример 4: Длительные операции с таймаутом

```typescript
async function runLongTask(clientId: string) {
  const result = await communicator.executeCommand(
    clientId,
    'npm run build',
    { timeout: 300000 } // 5 минут
  );
  
  // Отслеживаем прогресс в реальном времени
  communicator.on('command:stdout', (execId, chunk) => {
    if (execId === result.execId) {
      process.stdout.write(chunk);
    }
  });
  
  try {
    const final = await communicator.waitForCompletion(result.execId, 300000);
    
    if (final.status === 'timeout') {
      console.log('⏱️ Превышен таймаут, прерываю...');
      await communicator.killCommand(clientId, result.execId);
    } else if (final.exitCode === 0) {
      console.log('✅ Сборка успешна');
    } else {
      console.log(`❌ Сборка завершилась с ошибкой: ${final.exitCode}`);
    }
  } catch (err) {
    console.error('Ошибка:', err);
  }
}
```

## Запуск примеров

```bash
# Запустить сервер с примерами
bun run backendServer/example-usage.ts

# В другом терминале - запустить клиент
bun run backendServer/client.ts
```

## Советы по использованию

1. **Управление памятью**: Регулярно вызывайте `cleanupExecutions()` для очистки старых результатов
2. **Таймауты**: Всегда устанавливайте таймауты для команд, которые могут зависнуть
3. **Обработка ошибок**: Подписывайтесь на события `command:error` и `command:timeout`
4. **Health Check**: Периодически вызывайте `healthCheck()` для проверки доступности клиентов
5. **Потоковый вывод**: Используйте события `command:stdout` и `command:stderr` для real-time мониторинга
6. **Идентификаторы**: Используйте пользовательские `execId` для упрощения отслеживания команд

## Troubleshooting

### Клиент не подключается

```typescript
// Проверьте что сервер запущен
console.log(`Клиентов: ${communicator.getClientCount()}`);

// Проверьте порт и хост
const communicator = new ClientCommunicator(8080, '0.0.0.0');
```

### Команда не завершается

```typescript
// Используйте таймаут
const result = await communicator.executeCommand(
  clientId,
  command,
  { timeout: 30000 }
);

// Или принудительно прервите
await communicator.killCommand(clientId, result.execId);
```

### Утечка памяти

```typescript
// Регулярно очищайте старые результаты
setInterval(() => {
  const cleaned = communicator.cleanupExecutions(3600000);
  console.log(`Очищено ${cleaned} старых результатов`);
}, 3600000);
```

## Лицензия

MIT
