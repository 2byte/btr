# 🔌 Подключение к существующему браузеру

## Проблема

При использовании `browser://inspect` вы видите все открытые вкладки с восстановленными сеансами, но Selenium открывает чистый браузер.

## ✅ Решение

Метод `connect()` был исправлен для корректного подключения к уже запущенному браузеру.

## 📝 Как использовать

### Шаг 1: Запустите Chrome с remote debugging

**Windows (запустите BAT файл):**
```bash
start-chrome-debug.bat
```

**Или вручную:**
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Linux/Mac:**
```bash
google-chrome --remote-debugging-port=9222
# или
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

### Шаг 2: Откройте нужные вкладки

Откройте в этом браузере все нужные сайты, авторизуйтесь где нужно.

### Шаг 3: Подключитесь через Selenium

**Вариант A - Используйте готовый скрипт:**
```bash
cd remoteBrowser
bun connect-existing.ts
```

Это покажет:
- ✅ Список всех открытых вкладок
- ✅ Количество cookies в каждой
- ✅ Список доменов
- ✅ Сохранит сессию в JSON файл

**Вариант B - В своём коде:**
```typescript
import { SeleniumWd } from "./remoteBrowser/SeleniumWd";

// Подключиться к существующему браузеру
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Получить все существующие вкладки
const tabs = await wd.getTabsInfo();
console.log(`Найдено ${tabs.length} вкладок`);

tabs.forEach((tab, i) => {
  console.log(`${i + 1}. ${tab.title} - ${tab.url}`);
});

// Переключиться на нужную вкладку
await wd.switchToWindow(tabs[0].handle);

// Получить cookies
const cookies = await wd.getCookies();
console.log(`Cookies: ${cookies.length}`);
```

## 🔍 Проверка подключения

Перед подключением проверьте доступность браузера:

```bash
bun connect-existing.ts info
```

Или вручную:
```bash
curl http://localhost:9222/json/version
```

## ⚠️ Важные моменты

### 1. Браузер должен быть запущен с флагом `--remote-debugging-port`

Без этого флага подключение невозможно.

### 2. Не используйте `launch()` - используйте `connect()`

```typescript
// ❌ НЕПРАВИЛЬНО - запустит новый браузер
await wd.launch();

// ✅ ПРАВИЛЬНО - подключится к существующему
await wd.connect();
```

### 3. Метод `close()` закроет браузер

```typescript
// После работы НЕ вызывайте close(), если хотите оставить браузер открытым
// await wd.close(); // Это закроет браузер!

// Вместо этого просто завершите скрипт
```

### 4. Один порт = один браузер

Если нужно работать с несколькими браузерами одновременно:

```typescript
// Браузер 1 на порту 9222
const wd1 = SeleniumWd.init({ debuggerPort: 9222 });
await wd1.connect();

// Браузер 2 на порту 9223
const wd2 = SeleniumWd.init({ debuggerPort: 9223 });
await wd2.connect();
```

## 📊 Примеры использования

### Пример 1: Просмотр всех вкладок

```typescript
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

const tabs = await wd.getTabsInfo();
tabs.forEach((tab, i) => {
  console.log(`${i + 1}. ${tab.title}`);
  console.log(`   ${tab.url}`);
});
```

### Пример 2: Сохранение текущей сессии

```typescript
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Сохранить все вкладки и cookies
const session = await wd.exportSession();
await Bun.write("current-session.json", JSON.stringify(session));

console.log(`Saved ${session.tabs.length} tabs with cookies`);
```

### Пример 3: Работа с конкретной вкладкой

```typescript
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Найти вкладку с GitHub
const tabs = await wd.getTabsInfo();
const githubTab = tabs.find(t => t.url.includes("github.com"));

if (githubTab) {
  // Переключиться на неё
  await wd.switchToWindow(githubTab.handle);
  
  // Выполнить JavaScript
  const result = await wd.executeScript("return document.title");
  console.log("Title:", result);
  
  // Сделать скриншот
  const screenshot = await wd.takeScreenshot();
  await Bun.write("github.png", Buffer.from(screenshot, "base64"));
}
```

### Пример 4: Получение cookies с определённого домена

```typescript
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Получить все cookies из всех вкладок
const cookiesMap = await wd.getAllCookiesFromAllTabs();
const tabs = await wd.getTabsInfo();

// Найти cookies для github.com
for (const [handle, cookies] of cookiesMap) {
  const tab = tabs.find(t => t.handle === handle);
  if (tab && tab.url.includes("github.com")) {
    console.log("GitHub cookies:", cookies);
  }
}
```

## 🐛 Решение проблем

### Проблема: "Failed to connect to remote browser"

**Решение:**
1. Проверьте, что Chrome запущен с `--remote-debugging-port=9222`
2. Проверьте доступность: `curl http://localhost:9222/json/version`
3. Убедитесь, что порт не занят другим процессом

### Проблема: "Не вижу существующие вкладки"

**Решение:**
1. Используйте `connect()`, а не `launch()`
2. После `connect()` вызовите `getTabsInfo()` для получения всех вкладок
3. Проверьте, что вы подключаетесь к правильному порту

### Проблема: "Cookies не видны"

**Решение:**
1. Сначала переключитесь на нужную вкладку: `await wd.switchToWindow(handle)`
2. Затем получите cookies: `await wd.getCookies()`
3. Или используйте `getAllCookiesFromAllTabs()` для всех вкладок сразу

### Проблема: "Browser closes when script ends"

**Решение:**
НЕ вызывайте `await wd.close()` в конце скрипта. Это закроет браузер.

## 🚀 Быстрый старт

```bash
# 1. Запустите Chrome с remote debugging
start-chrome-debug.bat

# 2. Откройте нужные вкладки в Chrome вручную

# 3. Подключитесь через Selenium
bun connect-existing.ts

# 4. Или используйте свой код
```

## 📚 Дополнительно

- [SeleniumWd.ts](SeleniumWd.ts) - исходный код класса
- [SESSION_MANAGER_README.md](SESSION_MANAGER_README.md) - полная документация
- [connect-existing.ts](connect-existing.ts) - пример подключения

---

**Готово!** Теперь `connect()` корректно подключается к существующему браузеру со всеми открытыми вкладками и cookies. 🎉
