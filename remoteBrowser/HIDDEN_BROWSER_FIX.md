# 🔥 Решение: Браузер скрыт / не виден

## Проблема
Вы запускаете `bun connect-existing.ts` и видите в терминале, что браузер подключен и есть открытые вкладки, но самого окна браузера нет.

```
✅ Подключено к браузеру
📊 Найдено 3 открытых вкладок
```

**Причина:** Браузер был запущен в скрытом режиме (headless) или другим скриптом без GUI.

## ✅ РЕШЕНИЕ (1 команда!)

```bash
bun connect-existing.ts restart
```

**Что это делает:**
1. ✅ Сохранит текущую сессию (вкладки + cookies)
2. ✅ Закроет скрытый браузер
3. ✅ Запустит новый браузер **с видимым окном**
4. ✅ Теперь вы увидите браузер!

## Альтернативные решения

### Решение 2: Вручную закрыть и запустить

```bash
# Закрыть все Chrome процессы
bun connect-existing.ts kill

# Запустить видимый браузер
bun connect-existing.ts start

# Подключиться
bun connect-existing.ts
```

### Решение 3: Использовать BAT файл (Windows)

```bash
start-chrome-debug.bat
```

Это запустит Chrome с GUI и remote debugging.

## Проверка

После `restart` или `start` вы должны:
- ✅ Видеть окно Chrome на экране
- ✅ Видеть адресную строку chrome://version
- ✅ Моочь кликать и работать в браузере

## Команды скрипта

```bash
# Основные команды
bun connect-existing.ts           # Подключиться к существующему браузеру
bun connect-existing.ts restart   # 🔥 Перезапустить с видимым окном
bun connect-existing.ts start     # Запустить новый видимый браузер
bun connect-existing.ts kill      # Закрыть все Chrome процессы

# Проверка
bun connect-existing.ts info      # Проверить что браузер доступен
bun connect-existing.ts check     # То же что info
bun connect-existing.ts help      # Показать справку

# Автоматический режим
bun connect-existing.ts auto      # Подключиться или запустить если нет
```

## Что происходит при restart?

1. **Сохранение сессии:**
   ```
   💾 Сохранение текущей сессии...
   ✅ Сессия сохранена (3 вкладок)
   ```
   Ваши вкладки и cookies сохраняются в `temp-session-before-restart.json`

2. **Закрытие процессов:**
   ```
   🔴 Закрытие всех процессов Chrome...
   ✅ Процессы Chrome закрыты
   ```

3. **Запуск видимого браузера:**
   ```
   🚀 Запуск видимого браузера на порту 9222...
   ✅ Браузер запущен с GUI
   ```

4. **Готово!**
   Теперь вы видите окно браузера.

## Восстановление сессии после restart

Если хотите восстановить вкладки которые были до restart:

```typescript
import { SeleniumWd } from "./SeleniumWd";

const wd = SeleniumWd.init({ debuggerPort: 9222 });
await wd.connect();

// Восстановить сохранённую сессию
const session = await Bun.file("temp-session-before-restart.json").json();
await wd.importSession(session);

console.log(`Restored ${session.tabs.length} tabs!`);
```

Или через командную строку:

```bash
# После restart - восстановите сессию
bun SessionManager.example.ts restore
# Выберите файл: temp-session-before-restart.json
```

## Почему браузер был скрыт?

Возможные причины:
1. Запущен другим скриптом в headless режиме
2. Запущен через VBS скрипт с флагом hidden
3. Запущен через задачу планировщика в фоновом режиме
4. Запущен службой Windows

## Предотвращение проблемы

Всегда запускайте Chrome явно с GUI:

```bash
# Используйте этот скрипт для запуска
bun connect-existing.ts start

# Или BAT файл
start-chrome-debug.bat

# Или вручную
chrome.exe --remote-debugging-port=9222
```

## FAQ

**Q: Потеряю ли я вкладки при restart?**  
A: Нет! Команда `restart` автоматически сохраняет сессию перед закрытием.

**Q: Можно ли увидеть headless браузер?**  
A: Нет. Headless браузер не имеет GUI. Нужно перезапустить.

**Q: Безопасно ли использовать kill?**  
A: Да, но несохранённые данные в браузере будут потеряны. Используйте `restart` вместо `kill`.

**Q: Что если я хочу работать без GUI?**  
A: Используйте `launch()` с `headless: true` в вашем коде.

---

🎯 **Итого: просто запустите `bun connect-existing.ts restart`**
