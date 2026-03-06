# 🖥️ GUI для удалённого браузера

## Проблема

Подключение к удалённому браузеру работает только в терминале - видны вкладки, cookies, но нет графического интерфейса для интерактивной работы.

## ✅ Решение 1: Chrome DevTools Inspector (рекомендуется)

Самый простой способ - использовать встроенные Chrome DevTools для подключения к удалённому браузеру.

### Настройка

**1. Откройте Chrome на локальной машине**

**2. Перейдите по адресу:**
```
chrome://inspect/#devices
```

**3. Нажмите "Configure..." возле "Discover network targets"**

**4. Добавьте адрес удалённого браузера:**
```
81.24.214.134:9222
```

**5. Нажмите "Done"**

**6. Через несколько секунд увидите список удалённых вкладок:**
```
Remote Target
  https://www.google.com/
  https://visavi.net/
  ...
```

**7. Нажмите "inspect" на любой вкладке**

Откроется DevTools с полным просмотром и контролем удалённой страницы!

### Что вы можете делать:

✅ Видеть содержимое страницы в реальном времени  
✅ Взаимодействовать с элементами  
✅ Выполнять JavaScript  
✅ Видеть Network, Console, Sources  
✅ Делать скриншоты  
✅ Эмулировать устройства  

### Скриншот удалённой страницы

В DevTools → Console:
```javascript
// Сделать скриншот
(async () => {
  const screenshot = await new Promise(resolve => {
    chrome.debugger.sendCommand({tabId: chrome.devtools.inspectedWindow.tabId}, 
      'Page.captureScreenshot', {}, resolve);
  });
  console.log('data:image/png;base64,' + screenshot.data);
})();
```

## ✅ Решение 2: VNC (если на сервере есть Desktop)

Если на сервере установлен Desktop Environment (GNOME, KDE), можно использовать VNC.

### На сервере:

```bash
# Установите VNC сервер
sudo apt install tigervnc-standalone-server

# Настройте пароль
vncpasswd

# Запустите VNC
vncserver :1 -geometry 1920x1080 -depth 24

# Запустите Chrome в этой сессии
DISPLAY=:1 google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 &
```

### На локальной машине:

```bash
# Создайте SSH туннель для VNC
ssh -L 5901:localhost:5901 user@81.24.214.134

# Подключитесь VNC клиентом к localhost:5901
```

Используйте VNC клиент (TightVNC, RealVNC, или встроенный в Windows).

## ✅ Решение 3: X11 Forwarding через SSH

Если на сервере Linux с X11:

```bash
# Подключитесь с X11 forwarding
ssh -X user@81.24.214.134

# Запустите Chrome (окно откроется локально!)
google-chrome --remote-debugging-port=9222
```

Окно Chrome откроется на вашем экране, но будет работать на сервере!

## ✅ Решение 4: Автоматический скрипт для DevTools

Создам скрипт для автоматического открытия DevTools:

```typescript
// open-devtools.ts
import { spawn } from "child_process";

const remoteHost = "81.24.214.134";
const remotePort = 9222;

async function openDevTools() {
  console.log(`📡 Подключение к ${remoteHost}:${remotePort}...`);

  // Получаем список вкладок
  const response = await fetch(`http://${remoteHost}:${remotePort}/json`);
  const tabs = await response.json();

  console.log(`\n📂 Найдено ${tabs.length} вкладок:\n`);

  tabs.forEach((tab: any, i: number) => {
    if (tab.type === 'page') {
      console.log(`${i + 1}. ${tab.title}`);
      console.log(`   URL: ${tab.url}`);
      console.log(`   DevTools: ${tab.devtoolsFrontendUrl}`);
    }
  });

  // Открываем DevTools для первой вкладки
  if (tabs.length > 0 && tabs[0].devtoolsFrontendUrl) {
    const devtoolsUrl = `chrome-devtools://${tabs[0].devtoolsFrontendUrl.replace('devtools://', '')}`;
    
    console.log(`\n🚀 Открываем DevTools...`);
    console.log(`URL: ${devtoolsUrl}\n`);

    // Открываем в Chrome
    spawn('chrome', [devtoolsUrl], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }

  // Или открываем chrome://inspect
  console.log(`\n💡 Альтернатива - откройте в Chrome:`);
  console.log(`   chrome://inspect/#devices`);
  console.log(`   Добавьте: ${remoteHost}:${remotePort}`);
}

openDevTools();
```

## ✅ Решение 5: Headless Recorder + Puppeteer Viewer

Используйте браузерное расширение для просмотра удалённой сессии.

Установите [Puppeteer Recorder](https://chrome.google.com/webstore) и подключитесь к удалённому браузеру.

## 🎯 Рекомендация

**Для большинства случаев - используйте Chrome DevTools (Решение 1):**

1. Откройте: `chrome://inspect/#devices`
2. Configure → добавьте `81.24.214.134:9222`
3. Нажмите "inspect" на нужной вкладке
4. Работайте как с локальной страницей!

### Преимущества:
- ✅ Не требует дополнительной установки
- ✅ Полный функционал DevTools
- ✅ Просмотр в реальном времени
- ✅ Выполнение кода на удалённой странице
- ✅ Работает через файрволл (если порт открыт)

### Что НЕ работает через DevTools:
- ❌ Нельзя открывать новые вкладки (используйте Selenium для этого)
- ❌ Нет адресной строки (URL меняйте через код)
- ❌ Нет закладок, расширений
- ❌ **Загрузка файлов через диалоги выбора файлов**

## ⚠️ Ограничение: Загрузка файлов через DevTools

### Проблема

При использовании `chrome://inspect` для подключения к удалённому браузеру, **диалоги выбора файлов не работают**. Когда вы кликаете на `input[type="file"]`, диалоговое окно открывается, но выбор файла игнорируется.

Это известное ограничение Chrome DevTools Protocol при удалённом подключении.

### ✅ Решение: Программная загрузка файлов

Вместо использования диалога выбора файлов, загружайте файлы программно через Selenium:

#### Способ 1: Использовать готовый скрипт

```bash
# 1. Загрузите файл на удалённый сервер (если браузер удалённый)
scp C:\Users\user\image.png user@81.24.214.134:/home/user/

# 2. Загрузите файл в форму программно
bun upload-file.ts 'input#avatar' '/home/user/image.png'
```

**Скрипт `upload-file.ts` автоматически:**
- Подключается к удалённому браузеру
- Находит элемент `input[type="file"]` по указанному селектору
- Загружает файл, обходя диалоговое окно

#### Способ 2: Использовать API напрямую

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

// Автоматический поиск по ID, name или class
await wd.findAndUploadFile('avatar', '/home/user/image.png');
```

#### Способ 3: Через DevTools Console

Можно также использовать консоль DevTools для установки файлов программно:

```javascript
// В DevTools Console
const input = document.querySelector('input[type="file"]');

// Создаём File объект
const file = new File(['content'], 'filename.txt', { type: 'text/plain' });
const dataTransfer = new DataTransfer();
dataTransfer.items.add(file);
input.files = dataTransfer.files;

// Триггерим событие change
input.dispatchEvent(new Event('change', { bubbles: true }));
```

**Примечание:** Этот способ работает, но файл создаётся локально в браузере и содержит только текст из 'content'. Для реальных файлов используйте Selenium методы выше.

### 📝 Полный workflow загрузки файлов

```bash
# Шаг 1: Подготовка файла на удалённом сервере
scp local-file.pdf user@81.24.214.134:/tmp/upload.pdf

# Шаг 2: Откройте страницу с формой через DevTools или Selenium
bun connect-existing.ts
# Затем navigate к нужной странице

# Шаг 3: Используйте DevTools для поиска селектора
# chrome://inspect → inspect → DevTools → Elements
# Найдите input[type="file"] и скопируйте селектор

# Шаг 4: Загрузите файл программно
bun upload-file.ts 'input.file-upload' '/tmp/upload.pdf'

# Шаг 5: Отправьте форму (через DevTools или Selenium)
```

### 🎯 Рекомендации

**Для загрузки файлов в удалённый браузер:**

1. **Сначала** загрузите файл на удалённый сервер через `scp`, `sftp`, или другим способом
2. **Затем** используйте `upload-file.ts` для программной загрузки в форму
3. **Проверьте** результат через DevTools - должно показать имя файла
4. **Отправьте** форму обычным способом (клик на submit или программно)

**Альтернатива для локального браузера:**

Если вам нужно часто загружать файлы и вы работаете локально, вместо DevTools используйте:
- **VNC** (Решение 2) - полноценный удалённый рабочий стол с диалогами
- **X11 Forwarding** (Решение 3) - окно Chrome будет локальным с родными диалогами

## 📋 Полный workflow

```bash
# 1. В одном терминале - держите Selenium подключение
bun connect-existing.ts

# 2. В Chrome - откройте DevTools
chrome://inspect/#devices
# Configure → 81.24.214.134:9222

# 3. Работайте:
# - DevTools для просмотра и отладки
# - Selenium для программного управления (новые вкладки, навигация, cookies)
```

## 🔧 Если DevTools не подключается

```bash
# Проверьте доступность WebSocket
curl http://81.24.214.134:9222/json

# Должен вернуть список с webSocketDebuggerUrl
# Если нет - проверьте что Chrome запущен правильно

# Откройте порт для WebSocket (используется тот же 9222)
ssh user@81.24.214.134
sudo ufw allow 9222/tcp
```

## 🎬 Видео демонстрация workflow

1. **Локальная машина - Терминал:**
   ```bash
   bun connect-existing.ts
   # Видите список вкладок, управляете программно
   ```

2. **Локальная машина - Chrome:**
   ```
   chrome://inspect → 81.24.214.134:9222
   # Видите GUI, работаете интерактивно
   ```

3. **Комбинированная работа:**
   - Создаёте вкладки через Selenium
   - Видите результат в DevTools
   - Отлаживаете в DevTools
   - Собираете данные через Selenium

---

**Итого: Используйте `chrome://inspect` для GUI доступа к удалённому браузеру!** 🚀
