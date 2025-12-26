# Using Browser Tracker for Debugging

## What is this?

**Browser Tracker** - a developer tool for tracking browser activity and sending data to a local server for debugging web applications.

## Quick Start (3 steps)

### 1. Start local server

```bash
cd serverVideoCapture
bun run index.ts
```

Server will start on `http://localhost:8012`

### 2. Build and install extension

```bash
# From project root
bun run build:firefox-dev   # For Firefox
# or
bun run build:chrome-dev    # For Chrome/Opera/Safari
```

Install in browser:
- **Firefox**: `about:debugging` → Load Temporary Add-on → `dist/firefox-dev/manifest.json`
- **Chrome**: `chrome://extensions/` → Load unpacked → `dist/chrome-dev/`
- **Opera**: `opera://extensions/` → Load unpacked → `dist/opera-dev/`
- **Safari**: Develop → Show Extension Builder → Add Extension → `dist/chrome-dev/`

### 3. Use

Just open tabs in your browser - data is automatically sent to server!

## What's tracked

- ✅ Active tab (switching between tabs)
- ✅ URL and page title
- ✅ Activation time
- ✅ Cookies (optional)
- ✅ History of last 10 tabs

## Viewing data

### In Browser
Click extension icon (for dev versions) - popup will show:
- Current active tab
- Recent tabs history
- Clear history button

### On Server
Check server console - it will log all requests:
```
POST /api/tabs - tab activation
GET /target-domains - request for tracked domains list
```

Data is saved in `serverVideoCapture/storage/active_tabs/`

## Configuration

### Change server URL

Edit [browserTracker/background.js](browserTracker/background.js):

```javascript
const LOCAL_SERVER_URL = "http://localhost:8012"; // Your URL
const SEND_LOCAL_SERVER = true; // false - disable sending
```

After changes, rebuild extension:
```bash
bun run build:firefox-dev  # or chrome-dev
```

### Disable data sending

Set `SEND_LOCAL_SERVER = false` in `background.js` - extension will work locally without sending to server.

## Dev vs Prod versions

| | Development | Production |
|---|-------------|------------|
| Popup UI | ✅ Yes | ❌ No |
| Debugging | ✅ Convenient | - |
| Use case | Development | Background operation |
| Build command | `build:*-dev` | `build:*-prod` |

## Common scenarios

### 1. Debugging web application
```bash
# Start server
cd serverVideoCapture && bun run index.ts

# Start your web app
cd ../my-app && npm run dev

# Open in browser with extension
# Watch logs in server console
```

### 2. Testing on different browsers
```bash
# Build for all browsers
bun run build

# Install in Firefox, Chrome, Opera
# Test simultaneously
# All data goes to one server
```

### 3. Recording user session
```bash
# Start server with video recording
cd serverVideoCapture && bun run index.ts

# Use browser normally
# Server records activity to video_records/
```

## Поддержка браузеров

| Браузер | Manifest | Статус | Сборка |
|---------|----------|--------|--------|
| Firefox | v2 | ✅ Полная поддержка | `firefox-dev/prod` |
| Chrome | v3 | ✅ Полная поддержка | `chrome-dev/prod` |
| Opera | v3 | ✅ Полная поддержка | `opera-dev/prod` |
| Safari | v3 | ⚠️ Требует конвертации | Использовать `chrome-dev` |

## Troubleshooting

### Расширение не отправляет данные
1. Проверьте что сервер запущен: `http://localhost:8012`
2. Откройте консоль расширения (в `chrome://extensions/` или `about:debugging`)
3. Проверьте что `SEND_LOCAL_SERVER = true` в `background.js`

### Ошибка CORS
Сервер уже настроен с CORS headers. Если проблема сохраняется:
- Проверьте что URL в `background.js` совпадает с URL сервера
- Убедитесь что используете `http://localhost:8012` а не `127.0.0.1`

### Расширение не загружается
- **Firefox**: Проверьте `about:debugging` на ошибки
- **Chrome/Opera**: Проверьте `chrome://extensions/` или `opera://extensions/`
- Убедитесь что используете правильный manifest (v2 для Firefox, v3 для Chromium)

### Opera не работает
Opera использует Chromium. Используйте сборку `opera-dev` или `chrome-dev` (они идентичны).

## Security

⚠️ **IMPORTANT**: 
- Use only for development on local machine
- DO NOT install on production
- Extension sends data including cookies to local server
- Do not use for real users without their consent

## Additional Documentation

- [README.md](README.md) - Project overview
- [СБОРКА.md](СБОРКА.md) - Quick build guide (Russian)
- [BUILD_README.md](BUILD_README.md) - Detailed build system documentation
- [browserTracker/README.md](browserTracker/README.md) - Extension documentation
- [serverVideoCapture/README.md](serverVideoCapture/README.md) - Server documentation
