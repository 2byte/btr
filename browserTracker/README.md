# Browser Tracker

**Developer tool** for debugging and tracking browser activity on local server.

This extension sends data about active tabs to a local server (default `http://localhost:8012`) for web application development and debugging.

## Supported Browsers
- Firefox (Desktop & Mobile)
- Chrome (Desktop)
- Opera (Desktop)
- WebKit/Safari (uses Chrome build)

## Features

- ✅ Real-time active tab tracking
- ✅ Tab history storage
- ✅ Track tab switching
- ✅ Track URL updates
- ✅ Track window focus changes
- ✅ View current active tab
- ✅ History of last 10 active tabs
- ✅ Clear history functionality
- ✅ Cookie extraction from active tabs
- ✅ Optional local server integration

## Installation

⚠️ **IMPORTANT**: This is extension source code. For installation use build system from project root directory.

### Building Extension

From project root directory:

```bash
# Install Bun (if not installed yet)
powershell -c "irm bun.sh/install.ps1 | iex"

# Build all versions
bun run build

# Or build specific version
bun run build:firefox-dev
bun run build:chrome-dev
bun run build:opera-dev
```

### Installing in Browser

После сборки используйте файлы из `dist/`:

#### Firefox
1. `about:debugging#/runtime/this-firefox`
2. "Load Temporary Add-on"
3. Выбрать `dist/firefox-dev/manifest.json`

#### Chrome
1. `chrome://extensions/`
2. Включить "Developer mode"
3. "Load unpacked"
4. Выбрать папку `dist/chrome-dev/`

#### Opera
1. `opera://extensions/`
2. Включить "Developer mode"
3. "Load unpacked extension"
4. Выбрать папку `dist/opera-dev/`

#### WebKit/Safari
Use Chrome build (`dist/chrome-dev/`) and convert via Xcode.

## Browser Version Differences

### Firefox (Manifest V2)
- Supports `webRequest` with blocking
- `browser` API with Promise support
- `browser_action` for popup
- Requires `browser_specific_settings` with ID

### Chrome/Opera/WebKit (Manifest V3)
- Service Worker instead of background scripts
- `action` instead of `browser_action`
- `host_permissions` separate from `permissions`
- `declarativeNetRequest` instead of `webRequestBlocking`

## Structure

```
Редактируйте `background.js` для настройки:
- `LOCAL_SERVER_URL` - URL локального сервера (по умолчанию: http://localhost:8012)
- `SEND_LOCAL_SERVER` - включить/отключить отправку данных на сервер (по умолчанию: true)

### Локальный сервер

Сервер находится в директории `serverVideoCapture/`:

```bash
cd serverVideoCapture
bun run index.ts
```

Сервер запустится на `http://localhost:8012` и будет принимать данные от расширения.
├── popup.html         # Popup UI
├── popup.js           # Popup logic
└── icons/             # Extension icons (need to be added)
```

| Browser | Version | Manifest | Status |
|---------|---------|----------|--------|
| Firefox | 109+ | V2 | ✅ Full support |
| Chrome | Latest | V3 | ✅ Full support |
| Opera | Latest | V3 | ✅ Full support |
| Safari/WebKit | Latest | V3 | ⚠️ Requires conversion |

## Development Workflow

1. Start local server:
   ```bash
   cd serverVideoCapture
   bun run index.ts
   ```

2. Build extension:
   ```bash
   bun run build:firefox-dev  # or chrome-dev, opera-dev
   ```

3. Install in browser (see Installation section)

4. Open any tab - data will be sent to server

5. View logs in server console and extension console

## Use Cases

- Web application debugging
- User activity monitoring
- Automated testing
- User session recording
- Website behavior analysis

## Security Note

⚠️ **This is a developer tool and should only be used in local development environment.**

DO NOT install this extension on production machines or for regular users without their explicit consent.
- `browser.tabs.onActivated` - track tab activation
- `browser.tabs.onUpdated` - track tab updates
- `browser.windows.onFocusChanged` - track window focus
- `browser.storage.local` - data storage
- `browser.cookies.getAll` - cookie extraction

## Adding Icons

For proper extension functionality, add icons to the `icons/` folder:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

Or temporarily remove icon references from `manifest.json`.

## Configuration

Edit `background.js` to configure:
- `LOCAL_SERVER_URL` - your local server URL (default: http://localhost:3000)
- `SEND_LOCAL_SERVER` - enable/disable server communication (default: true)

## Data Tracked

- Tab ID
- Tab URL
- Tab title
- Activation timestamp
- Window ID
- Cookies (optional)

## Storage

All data is stored locally using `browser.storage.local`.

## Browser Compatibility

- Firefox 109+
- Works with both Firefox Desktop and Firefox for Android
