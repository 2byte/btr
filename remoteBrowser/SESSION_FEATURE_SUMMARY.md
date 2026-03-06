# 🎉 Добавлена функциональность восстановления сессий браузера

## Что реализовано

В класс `SeleniumWd` добавлен полный функционал для работы с сессиями браузера:

### ✅ Основные возможности

1. **Получение информации о вкладках**
   - `getTabsInfo()` - получить список всех открытых вкладок с URL и заголовками
   - `getAllWindows()` - получить все window handles

2. **Управление cookies**
   - `getCookies()` - получить cookies текущего домена
   - `getAllCookiesFromAllTabs()` - получить cookies из всех вкладок
   - `addCookie(cookie)` - добавить один cookie
   - `setCookies(cookies)` - установить массив cookies
   - `deleteAllCookies()` - удалить все cookies

3. **Сохранение и восстановление сессий**
   - `saveSession()` - сохранить текущую сессию (вкладки + cookies)
   - `exportSession()` - экспортировать в JSON для файла
   - `importSession(data)` - импортировать и восстановить из JSON
   - `restoreSession(tabs, cookies)` - восстановить по данным

### 📁 Созданные файлы

```
remoteBrowser/
├── SeleniumWd.ts                    - Основной класс (обновлён)
├── SESSION_MANAGER_README.md        - Полная документация
├── QUICKSTART_SESSION.md            - Быстрый старт
├── SessionManager.example.ts        - CLI инструмент с примерами
└── demo-session.ts                  - Простая демонстрация
```

## 🚀 Быстрый запуск

### Демонстрация

```bash
cd remoteBrowser
bun demo-session.ts
```

Это покажет:
- Открытие браузера с несколькими вкладками
- Сохранение сессии (вкладки + cookies)
- Закрытие браузера
- Открытие нового браузера
- Восстановление всех вкладок с cookies

### CLI инструмент

```bash
# Сохранить текущую сессию браузера
bun SessionManager.example.ts save

# Восстановить сохранённую сессию
bun SessionManager.example.ts restore

# Клонировать сессию между браузерами
bun SessionManager.example.ts clone

# Просмотреть вкладки и cookies
bun SessionManager.example.ts manage

# Автоматическое резервное копирование
bun SessionManager.example.ts backup 10  # каждые 10 минут
```

## 💻 Пример кода

```typescript
import { SeleniumWd } from "./remoteBrowser/SeleniumWd";

// 1. Подключиться к существующему браузеру
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// 2. Сохранить сессию
const session = await wd.exportSession();
console.log(`Сохранено ${session.tabs.length} вкладок`);

// 3. Сохранить в файл
await Bun.write("session.json", JSON.stringify(session));

// 4. Восстановить в новом браузере
const wd2 = SeleniumWd.init({ debuggerPort: 9223 });
await wd2.launch();

const savedSession = await Bun.file("session.json").json();
await wd2.importSession(savedSession);
console.log("Сессия восстановлена!");
```

## 🎯 Сценарии использования

### 1. Восстановление рабочего окружения
Сохраните все открытые вкладки перед выключением и восстановите на следующий день.

### 2. Клонирование сессии
Скопируйте авторизованную сессию с одного браузера на другой.

### 3. Резервное копирование
Автоматически сохраняйте сессию каждые N минут.

### 4. Тестирование
Сохраните состояние браузера для воспроизведения багов.

### 5. Миграция
Перенесите сессию между машинами через JSON файл.

## 📊 Структура данных

### Формат сохранённой сессии

```json
{
  "tabs": [
    {
      "handle": "CDwindow-123...",
      "url": "https://google.com",
      "title": "Google"
    }
  ],
  "cookies": {
    "https://google.com": [
      {
        "name": "NID",
        "value": "abc123...",
        "domain": ".google.com",
        "path": "/",
        "secure": true,
        "httpOnly": true
      }
    ]
  }
}
```

## 🔧 Технические детали

### Типы

```typescript
interface TabInfo {
  handle: string;  // Window handle ID
  url: string;     // URL страницы
  title: string;   // Заголовок страницы
}

interface SeleniumCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expiry?: number;      // секунды с 1970
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}
```

### Методы SeleniumWd

| Метод | Описание |
|-------|----------|
| `getTabsInfo()` | Получить информацию о всех вкладках |
| `getCookies()` | Получить cookies текущего домена |
| `getAllCookiesFromAllTabs()` | Получить cookies из всех вкладок |
| `setCookies(cookies)` | Установить cookies |
| `addCookie(cookie)` | Добавить один cookie |
| `deleteAllCookies()` | Удалить все cookies |
| `saveSession()` | Сохранить сессию (Map) |
| `exportSession()` | Экспортировать в JSON |
| `importSession(data)` | Импортировать из JSON |
| `restoreSession(tabs, cookies)` | Восстановить вкладки и cookies |

## ⚠️ Важно знать

1. **Cookies и домены**: Cookies можно устанавливать только после навигации на соответствующий домен.

2. **Порты**: Разные экземпляры браузера должны использовать разные порты отладки (9222, 9223, 9224...).

3. **Remote debugging**: Для подключения к существующему браузеру, запустите Chrome с флагом:
   ```bash
   chrome.exe --remote-debugging-port=9222
   ```

4. **Производительность**: Восстановление занимает ~1-3 секунды на вкладку.

## 📖 Документация

- **[QUICKSTART_SESSION.md](remoteBrowser/QUICKSTART_SESSION.md)** - Быстрый старт и базовые примеры
- **[SESSION_MANAGER_README.md](remoteBrowser/SESSION_MANAGER_README.md)** - Полная документация API
- **[demo-session.ts](remoteBrowser/demo-session.ts)** - Рабочая демонстрация
- **[SessionManager.example.ts](remoteBrowser/SessionManager.example.ts)** - Примеры использования

## 🎬 Демо

Запустите демонстрацию чтобы увидеть работу в действии:

```bash
cd remoteBrowser
bun demo-session.ts
```

Демо:
1. ✅ Запустит браузер
2. ✅ Откроет 3 вкладки (Google, GitHub, StackOverflow)
3. ✅ Сохранит сессию с cookies
4. ✅ Закроет браузер
5. ✅ Запустит новый браузер
6. ✅ Восстановит все вкладки и cookies

---

**Готово к использованию!** 🚀

Все зависимости уже установлены (`selenium-webdriver` присутствует в `package.json`).
