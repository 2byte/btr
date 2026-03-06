# Управление сессиями браузера - Session Manager

Модуль для сохранения и восстановления сессий браузера, включая открытые вкладки и cookies.

## Возможности

- ✅ Сохранение всех открытых вкладок с их URL и заголовками
- ✅ Экспорт всех cookies из каждой вкладки
- ✅ Восстановление сессии в новом экземпляре браузера
- ✅ Клонирование сессии между браузерами
- ✅ Автоматическое резервное копирование сессий
- ✅ Управление отдельными вкладками и cookies

## API

### Основные методы SeleniumWd

#### `getTabsInfo(): Promise<TabInfo[]>`
Получает информацию о всех открытых вкладках.

```typescript
const tabs = await wd.getTabsInfo();
tabs.forEach((tab, i) => {
  console.log(`Tab ${i + 1}: ${tab.title} - ${tab.url}`);
});
```

#### `getCookies(): Promise<SeleniumCookie[]>`
Получает cookies текущего домена.

```typescript
const cookies = await wd.getCookies();
console.log(`Found ${cookies.length} cookies`);
```

#### `getAllCookiesFromAllTabs(): Promise<Map<string, SeleniumCookie[]>>`
Получает cookies из всех открытых вкладок.

```typescript
const cookiesMap = await wd.getAllCookiesFromAllTabs();
for (const [handle, cookies] of cookiesMap) {
  console.log(`Tab ${handle}: ${cookies.length} cookies`);
}
```

#### `setCookies(cookies: SeleniumCookie[]): Promise<void>`
Устанавливает cookies для текущего домена.

```typescript
await wd.setCookies([
  {
    name: "session_id",
    value: "abc123",
    domain: ".example.com",
    path: "/",
    secure: true,
  }
]);
```

#### `saveSession(): Promise<{tabs, cookiesByTab}>`
Сохраняет текущую сессию (вкладки + cookies).

```typescript
const session = await wd.saveSession();
console.log(`Saved ${session.tabs.length} tabs`);
```

#### `exportSession(): Promise<{tabs, cookies}>`
Экспортирует сессию в JSON-формат для сохранения в файл.

```typescript
const sessionData = await wd.exportSession();
fs.writeFileSync("session.json", JSON.stringify(sessionData));
```

#### `importSession(sessionData): Promise<void>`
Импортирует и восстанавливает сессию из JSON-данных.

```typescript
const sessionData = JSON.parse(fs.readFileSync("session.json", "utf-8"));
await wd.importSession(sessionData);
```

#### `restoreSession(tabs, cookiesByUrl): Promise<void>`
Восстанавливает сессию по массиву вкладок и cookies.

```typescript
await wd.restoreSession(tabs, cookiesMap);
```

## Примеры использования

### 1. Простое сохранение и восстановление

```typescript
import { SeleniumWd } from "./SeleniumWd";

// Подключиться к браузеру и сохранить сессию
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

const sessionData = await wd.exportSession();
fs.writeFileSync("session.json", JSON.stringify(sessionData));

await wd.close();

// Восстановить в новом браузере
const wd2 = SeleniumWd.init({ debuggerPort: 9223 });
await wd2.launch();

const savedSession = JSON.parse(fs.readFileSync("session.json", "utf-8"));
await wd2.importSession(savedSession);
```

### 2. Клонирование сессии между браузерами

```typescript
// Браузер-источник
const source = SeleniumWd.init({ debuggerPort: 9222 });
await source.connect();
const session = await source.exportSession();

// Браузер-назначение
const target = SeleniumWd.init({ debuggerPort: 9224 });
await target.launch();
await target.importSession(session);

console.log("Сессия склонирована!");
```

### 3. Автоматическое резервное копирование

```typescript
async function autoBackup(intervalMinutes: number) {
  setInterval(async () => {
    const wd = SeleniumWd.init({ debuggerPort: 9222 });
    await wd.connect();
    
    const session = await wd.exportSession();
    const timestamp = new Date().toISOString();
    const filename = `backup-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(session));
    console.log(`Резервная копия сохранена: ${filename}`);
    
    await wd.close();
  }, intervalMinutes * 60 * 1000);
}

await autoBackup(5); // Каждые 5 минут
```

### 4. Работа с отдельными вкладками

```typescript
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Получить все вкладки
const tabs = await wd.getTabsInfo();

// Переключиться на вкладку
await wd.switchToWindow(tabs[0].handle);

// Получить cookies этой вкладки
const cookies = await wd.getCookies();

// Добавить новый cookie
await wd.addCookie({
  name: "my_cookie",
  value: "my_value",
  path: "/",
});
```

## SessionManager.example.ts

Готовый CLI-инструмент для управления сессиями:

```bash
# Сохранить текущую сессию браузера
bun SessionManager.example.ts save

# Восстановить сессию из файла
bun SessionManager.example.ts restore

# Клонировать сессию между браузерами
bun SessionManager.example.ts clone

# Просмотреть вкладки и cookies
bun SessionManager.example.ts manage

# Автоматическое резервное копирование каждые 10 минут
bun SessionManager.example.ts backup 10
```

## Типы данных

### TabInfo
```typescript
interface TabInfo {
  handle: string;  // ID вкладки (window handle)
  url: string;     // URL страницы
  title: string;   // Заголовок страницы
}
```

### SeleniumCookie
```typescript
interface SeleniumCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expiry?: number;      // секунды с начала эпохи
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}
```

### Session Data Format
```typescript
{
  tabs: TabInfo[];
  cookies: {
    [url: string]: SeleniumCookie[];
  }
}
```

## Важные моменты

1. **Порт отладки**: Убедитесь, что Chrome запущен с `--remote-debugging-port`
2. **Cookies и домены**: Cookies можно устанавливать только после навигации на соответствующий домен
3. **Async операции**: Все методы асинхронные, используйте `await`
4. **Обработка ошибок**: Методы восстановления логируют предупреждения, но продолжают работу
5. **Закрытие**: Всегда вызывайте `wd.close()` для освобождения ресурсов

## Кейсы использования

### Разработка
- Быстрое восстановление рабочего окружения после перезапуска браузера
- Переключение между разными сессиями (личная/рабочая)

### Тестирование
- Сохранение состояния для воспроизведения багов
- Клонирование аутентифицированных сессий

### Автоматизация
- Резервное копирование важных сессий
- Миграция сессий между машинами

## Устранение проблем

### Не удается установить cookies
```typescript
// Сначала перейдите на домен
await wd.navigateTo("https://example.com");
// Затем устанавливайте cookies
await wd.setCookies(cookies);
```

### Вкладки не восстанавливаются
- Проверьте, что URLs доступны
- Убедитесь, что cookies имеют правильные домены
- Проверьте логи на предупреждения

### Browser не подключается
```typescript
// Убедитесь, что Chrome запущен с remote debugging
// chrome.exe --remote-debugging-port=9222

const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

if (await wd.isConnected()) {
  console.log("Подключено!");
}
```

## Производительность

- Сохранение сессии: ~100-500ms (зависит от количества вкладок)
- Восстановление: ~1-3s на вкладку (зависит от скорости загрузки)
- Cookies: ~10-50ms на домен

## Лицензия

Часть проекта browserTracker
