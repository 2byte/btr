# Remote Browser Management

Модуль для управления удалёнными экземплярами браузера через Selenium WebDriver и Puppeteer.

## Компоненты

### SeleniumWd.ts
Класс для управления браузером через Selenium WebDriver с поддержкой:
- Подключения к существующему браузеру (remote debugging)
- Запуска нового экземпляра браузера (GUI или headless)
- **Сохранения и восстановления сессий (вкладки + cookies)** ⭐ NEW
- Навигации и выполнения JavaScript
- Управления вкладками и окнами
- Создания скриншотов

### RemoteBrowserConnector.ts
Класс для работы с браузером через Puppeteer:
- Подключение к удалённому браузеру
- Управление вкладками
- Работа с cookies
- Закрытие вкладок

### RemoteBrowserProcess.ts
Управление процессом Chrome:
- Запуск Chrome с remote debugging
- Копирование профилей
- Управление процессом

## 🆕 Session Manager - Управление сессиями

**Новая функциональность для сохранения и восстановления сессий браузера!**

### Возможности

✅ Сохранение всех открытых вкладок с URL и заголовками  
✅ Экспорт всех cookies из каждой вкладки  
✅ Восстановление сессии в новом браузере  
✅ Клонирование сессии между браузерами  
✅ **Подключение к существующему браузеру с открытыми вкладками** ⭐  
✅ **Подключение к удалённому браузеру на сервере** 🌐 NEW  
✅ **Загрузка файлов в формы (обход ограничений DevTools)** 📤 NEW  
✅ Автоматическое резервное копирование  
✅ Импорт/экспорт в JSON

### Важно: Локальный vs Удалённый браузер

**Локальный браузер** (на этом компьютере):
- Используйте `start`/`restart` для запуска
- IP на 2ip.ru будет ваш локальный IP

**Удалённый браузер** (на сервере):
- НЕ используйте `start`/`restart` (они запускают локально!)
- Запустите Chrome на сервере через SSH
- IP на 2ip.ru будет IP сервера
- См. [REMOTE_BROWSER_SETUP.md](REMOTE_BROWSER_SETUP.md) для настройки

### Быстрый старт

**Подключение к существующему браузеру:**
```bash
# 1. Запустите Chrome с remote debugging
start-chrome-debug.bat

# 2. Откройте нужные вкладки в Chrome вручную

# 3. Подключитесь и посмотрите все вкладки
bun connect-existing.ts

# 4. Откройте GUI для визуального управления (для удалённого браузера)
bun connect-existing.ts gui
# ИЛИ
bun open-devtools.ts

# 5. Проверьте доступность браузера
bun connect-existing.ts info

# 🔥 Если браузер скрыт / не виден:
bun connect-existing.ts restart
```

**Работа с сессиями:**
```bash
# Демонстрация
bun demo-session.ts

# CLI инструмент
bun SessionManager.example.ts save      # Сохранить сессию
bun SessionManager.example.ts restore   # Восстановить сессию
bun SessionManager.example.ts clone     # Клонировать между браузерами
bun SessionManager.example.ts backup 10 # Авто-бэкап каждые 10 мин
```

### Пример кода

**Подключение к существующему браузеру:**
```typescript
import { SeleniumWd } from "./SeleniumWd";

// Подключиться к уже запущенному браузеру (с открытыми вкладками)
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Получить все существующие вкладки
const tabs = await wd.getTabsInfo();
console.log(`Found ${tabs.length} existing tabs`);

// Получить cookies из всех вкладок
const cookies = await wd.getAllCookiesFromAllTabs();

// Сохранить текущую сессию
const session = await wd.exportSession();
await Bun.write("session.json", JSON.stringify(session));
```

**Создание и восстановление сессии:**
```typescript
import { SeleniumWd } from "./SeleniumWd";

// Сохранить сессию
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();
const session = await wd.exportSession();
await Bun.write("session.json", JSON.stringify(session));

// Восстановить в новом браузере
const wd2 = SeleniumWd.init({ debuggerPort: 9223 });
await wd2.launch();
await wd2.importSession(session);
```

### Документация

- **[GUI_FOR_REMOTE.md](GUI_FOR_REMOTE.md)** - GUI для управления удалённым браузером 🖥️ NEW
- **[FILE_UPLOAD_FIX.md](FILE_UPLOAD_FIX.md)** - Загрузка файлов (обход ограничений DevTools) 📤 NEW
- **[VNC_SETUP.md](VNC_SETUP.md)** - Полноценный GUI с VNC (загрузка файлов!) 🖥️ NEW
- **[WRONG_IP_FIX.md](WRONG_IP_FIX.md)** - Вижу свой IP вместо IP сервера 🆘
- **[REMOTE_BROWSER_SETUP.md](REMOTE_BROWSER_SETUP.md)** - Настройка удалённого браузера на сервере 🌐
- **[HIDDEN_BROWSER_FIX.md](HIDDEN_BROWSER_FIX.md)** - Решение: Браузер скрыт / не виден 🔥
- **[CONNECT_EXISTING_README.md](CONNECT_EXISTING_README.md)** - Подключение к существующему браузеру ⭐
- **[SESSION_FEATURE_SUMMARY.md](SESSION_FEATURE_SUMMARY.md)** - Обзор функциональности ⭐
- **[QUICKSTART_SESSION.md](QUICKSTART_SESSION.md)** - Быстрый старт
- **[SESSION_MANAGER_README.md](SESSION_MANAGER_README.md)** - Полная документация API
- **[demo-session.ts](demo-session.ts)** - Рабочая демонстрация
- **[connect-existing.ts](connect-existing.ts)** - Подключение к открытому браузеру
- **[open-devtools.ts](open-devtools.ts)** - Открытие GUI для удалённого браузера
- **[upload-file.ts](upload-file.ts)** - Загрузка файлов в формы (обход ограничений DevTools) 📤 NEW
- **[SessionManager.example.ts](SessionManager.example.ts)** - CLI инструмент
- **[setup-remote-chrome.sh](setup-remote-chrome.sh)** - Скрипт установки Chrome на сервере

## Использование

### Базовое использование SeleniumWd

```typescript
import { SeleniumWd } from "./SeleniumWd";

// Запустить новый браузер
const wd = SeleniumWd.init({
  debuggerPort: 9222,
  headless: false,
});
await wd.launch();
await wd.navigateTo("https://google.com");

// Или подключиться к существующему
const wd2 = SeleniumWd.init({ debuggerPort: 9222 });
await wd2.connect();

// Работа с вкладками
const tabs = await wd.getTabsInfo();
await wd.switchToWindow(tabs[0].handle);

// Cookies
const cookies = await wd.getCookies();
await wd.setCookies(cookies);

// Скриншот
const screenshot = await wd.takeScreenshot();
```

### 📤 Загрузка файлов в формы (обход ограничений DevTools)

**Проблема:** При использовании `chrome://inspect` для GUI доступа к удалённому браузеру, диалоги выбора файлов не работают.

**Решение:** Используйте программную загрузку файлов через Selenium!

#### Способ 1: Готовый скрипт

```bash
# 1. Загрузите файл на сервер (для удалённого браузера)
scp C:\Users\user\document.pdf user@81.24.214.134:/tmp/

# 2. Загрузите файл в форму программно
bun upload-file.ts 'input#file-upload' '/tmp/document.pdf'

# Для локального браузера:
bun upload-file.ts 'input[name="avatar"]' 'C:\Users\user\image.png' localhost 9222
```

#### Способ 2: Через API

```typescript
import { SeleniumWd } from "./SeleniumWd";

const wd = SeleniumWd.init({
  debuggerHost: "81.24.214.134",
  debuggerPort: 9222,
});
await wd.connect();

// Загрузка одного файла
await wd.uploadFile('input#avatar', '/home/user/image.png');

// Загрузка нескольких файлов
await wd.uploadMultipleFiles('input#photos', [
  '/home/user/photo1.jpg',
  '/home/user/photo2.jpg'
]);

// Автопоиск по ID, name или class
await wd.findAndUploadFile('avatar', '/home/user/image.png');
```

**Важно:**
- Путь к файлу должен быть на машине, где **запущен Chrome**
- Для удалённого браузера: путь на удалённом сервере
- Для локального браузера: путь на локальной машине

**Альтернатива:** Используйте VNC для полноценного GUI с родными диалогами - см. [VNC_SETUP.md](VNC_SETUP.md)

### Puppeteer подход (RemoteBrowserConnector)

```typescript
import { RemoteBrowserConnector } from "./RemoteBrowserConnector";

const connector = new RemoteBrowserConnector("http://localhost:9222");
await connector.launch();

// Получить все вкладки
const tabs = await connector.getAllTabs();

// Открыть новую вкладку с cookies
await connector.newTab("https://example.com", cookies);

// Закрыть вкладку
await connector.closeTab(tabId);
```

## Требования

- Node.js / Bun
- Chrome или Chromium
- selenium-webdriver (установлен)
- puppeteer (установлен)

## Remote Debugging

Для подключения к существующему браузеру запустите Chrome с флагом:

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Linux/Mac
chrome --remote-debugging-port=9222
```

## VBS скрипты

Директория содержит VBS скрипты для управления Chrome на Windows:

- `start_chrome.vbs` - Запуск Chrome с remote debugging
- `start_chrome_with_profile.vbs` - Запуск с профилем
- `copy_profile_hidden.vbs` - Копирование профиля
- `stop.vbs` - Остановка Chrome
- `restart.vbs` - Перезапуск Chrome

## Структура

```
remoteBrowser/
├── SeleniumWd.ts                    # Selenium WebDriver класс
├── RemoteBrowserConnector.ts        # Puppeteer коннектор
├── RemoteBrowserProcess.ts          # Управление процессом Chrome
├── importCookiesToRemote.ts         # Импорт cookies
├── SESSION_FEATURE_SUMMARY.md       # ⭐ Обзор Session Manager
├── QUICKSTART_SESSION.md            # Быстрый старт
├── SESSION_MANAGER_README.md        # Полная документация
├── demo-session.ts                  # Демонстрация
├── SessionManager.example.ts        # CLI инструмент
└── *.vbs                           # Windows скрипты
```

## Сценарии использования

### 1. Восстановление рабочего окружения
Сохраните все вкладки с авторизацией перед выключением компьютера, восстановите на следующий день.

### 2. Клонирование сессии
Скопируйте авторизованную сессию с одного браузера/машины на другой.

### 3. Автоматическое тестирование
Управляйте браузером программно для автоматизации тестов.

### 4. Резервное копирование
Автоматически сохраняйте сессию каждые N минут.

### 5. Веб-скрапинг
Выполняйте скрапинг с сохранением авторизации между запусками.

## Поддерживаемые браузеры

- Google Chrome
- Chromium
- Microsoft Edge (через Chrome DevTools Protocol)

## Лицензия

Часть проекта browserTracker
