# Быстрый старт - Session Manager

## Что добавлено

В класс `SeleniumWd` добавлены методы для работы с сессиями браузера:

### 🔧 Новые методы

- `getTabsInfo()` - получить список всех открытых вкладок
- `getCookies()` - получить cookies текущего домена
- `getAllCookiesFromAllTabs()` - получить cookies из всех вкладок
- `setCookies(cookies)` - установить cookies
- `addCookie(cookie)` - добавить один cookie
- `saveSession()` - сохранить сессию (вкладки + cookies)
- `exportSession()` - экспортировать в JSON
- `importSession(data)` - импортировать из JSON
- `restoreSession(tabs, cookies)` - восстановить вкладки и cookies

## 🚀 Быстрый запуск

### 1. Демонстрация (самый простой способ)

```bash
cd remoteBrowser
bun demo-session.ts
```

Скрипт:
- Откроет браузер
- Создаст несколько вкладок
- Сохранит сессию
- Закроет браузер
- Откроет новый браузер
- Восстановит все вкладки и cookies

### 2. CLI инструмент

```bash
# Сохранить текущую сессию браузера (порт 9222)
bun SessionManager.example.ts save

# Восстановить сессию
bun SessionManager.example.ts restore

# Клонировать сессию между браузерами
bun SessionManager.example.ts clone

# Просмотр вкладок и cookies
bun SessionManager.example.ts manage

# Автоматическое резервное копирование каждые 10 минут
bun SessionManager.example.ts backup 10
```

### 3. Программное использование

```typescript
import { SeleniumWd } from "./SeleniumWd";

// Подключиться к существующему браузеру
const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Сохранить сессию
const session = await wd.exportSession();
console.log(`Сохранено ${session.tabs.length} вкладок`);

// Сохранить в файл
Bun.write("session.json", JSON.stringify(session));

// Восстановить в новом браузере
const wd2 = SeleniumWd.init({ debuggerPort: 9223 });
await wd2.launch();
await wd2.importSession(session);
```

## 📝 Требования

1. Chrome должен быть установлен
2. Для подключения к существующему браузеру - запустите Chrome с флагом:
   ```bash
   chrome.exe --remote-debugging-port=9222
   ```

## 📚 Документация

- [SESSION_MANAGER_README.md](SESSION_MANAGER_README.md) - Полная документация
- [demo-session.ts](demo-session.ts) - Простая демонстрация
- [SessionManager.example.ts](SessionManager.example.ts) - CLI инструмент с примерами

## 💡 Примеры использования

### Восстановление рабочего окружения

```typescript
// Сохраните сессию перед закрытием работы
const session = await wd.exportSession();
Bun.write("work-session.json", JSON.stringify(session));

// На следующий день - восстановите
const saved = await Bun.file("work-session.json").json();
await wd.importSession(saved);
```

### Клонирование сессии

```typescript
// Из браузера A (порт 9222) в браузер B (порт 9223)
const sourceWd = SeleniumWd.init({ debuggerPort: 9222 });
await sourceWd.connect();
const session = await sourceWd.exportSession();

const targetWd = SeleniumWd.init({ debuggerPort: 9223 });
await targetWd.launch();
await targetWd.importSession(session);
```

### Резервное копирование

```typescript
// Автоматическое сохранение каждые 5 минут
setInterval(async () => {
  const wd = SeleniumWd.init({ debuggerPort: 9222 });
  await wd.connect();
  const session = await wd.exportSession();
  await Bun.write(`backup-${Date.now()}.json`, JSON.stringify(session));
  await wd.close();
}, 5 * 60 * 1000);
```

## ⚠️ Важные замечания

1. **Cookies и домены**: Cookies привязаны к доменам. При восстановлении сначала открывается URL, затем устанавливаются cookies.

2. **Порты**: Разные экземпляры браузера должны использовать разные порты отладки.

3. **Headless режим**: Используйте `headless: false` чтобы видеть браузер, или `headless: true` для фонового режима.

4. **Производительность**: Восстановление ~1-3 секунды на вкладку (зависит от скорости загрузки страниц).

## 🐛 Решение проблем

### Не удается подключиться к браузеру
```typescript
// Убедитесь, что Chrome запущен с remote debugging
// Проверьте порт
const wd = SeleniumWd.init({ debuggerPort: 9222 });
const connected = await wd.isConnected();
console.log("Connected:", connected);
```

### Cookies не устанавливаются
```typescript
// Сначала откройте страницу домена
await wd.navigateTo("https://example.com");
// Затем устанавливайте cookies для этого домена
await wd.setCookies(cookies);
```

### Вкладки восстанавливаются без данных
- Проверьте, что cookies были правильно сохранены
- Убедитесь, что домены cookies совпадают с URL вкладок
- Проверьте срок действия cookies (параметр `expiry`)

## 🎯 Следующие шаги

1. Попробуйте запустить демо: `bun demo-session.ts`
2. Изучите полную документацию в [SESSION_MANAGER_README.md](SESSION_MANAGER_README.md)
3. Интегрируйте в свой код используя примеры выше
