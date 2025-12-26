# Browser Tracker

**Developer tool** for debugging and tracking browser activity on local server.

Supports: Chrome, Firefox, Opera, WebKit (Safari).

## 🚀 Quick Start

### 1. Install Bun
```bash
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. Build Extensions
```bash
# Build all versions
bun run build

# Build and pack to ZIP
bun run build:pack
```

### 3. Install in Browser
- **Firefox**: `about:debugging` → Load Temporary Add-on → select `dist/firefox-dev/manifest.json`
- **Chrome**: `chrome://extensions/` → Developer mode → Load unpacked → select `dist/chrome-dev/`
- **Opera**: `opera://extensions/` → Developer mode → Load unpacked → select `dist/opera-dev/`
- **Safari**: Develop → Show Extension Builder → Add Extension → select `dist/chrome-dev/`

## 📦 Project Structure

```
browserTracker/                # Extension source code
├── manifest.json             # Base manifest
├── background.js             # Background script
├── popup.html/js             # Popup interface
└── icons/                    # Icons

dist/                         # Built versions (generated)
├── firefox-dev/              # Firefox with popup
├── firefox-prod/             # Firefox without popup
├── chrome-dev/               # Chrome with popup
├── chrome-prod/              # Chrome without popup
├── opera-dev/                # Opera with popup
└── opera-prod/               # Opera without popup

packed/                       # ZIP archives (generated)
serverVideoCapture/           # Local server for recording
```

## 🛠️ Build System

### Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build all versions |
| `bun run build:firefox-dev` | Firefox dev only |
| `bun run build:firefox-prod` | Firefox prod only |
| `bun run build:chrome-dev` | Chrome dev only |
| `bun run build:chrome-prod` | Chrome prod only |
| `bun run build:opera-dev` | Opera dev only |
| `bun run build:opera-prod` | Opera prod only |
| `bun run pack` | Pack to ZIP |
| `bun run build:pack` | Build and pack |
| `bun run clean` | Clean dist/ and packed/ |

### Versions

#### Development (with popup)
- Includes popup interface for debugging
- For development and testing

#### Production (without popup)
- Background operation only
- For store publishing

### Browser Differences

| | Firefox | Chrome/Opera |
|---|---------|--------------|
| Manifest | v2 | v3 |
| Background | scripts | service_worker |
| Popup | browser_action | action |
| Host permissions | in permissions | separate host_permissions |
| webRequest blocking | ✅ Yes | ❌ No (use declarativeNetRequest) |

## 📝 Configuration

Build settings are in [build.config.ts](build.config.ts):

```typescript
export const configs = {
  "firefox-dev": {
    name: "Browser Tracker Dev",
    version: "1.0.0",
    manifestVersion: 2,
    includePopup: true,
    // ...
  },
  // ...
}
```

You can customize:
- Name and version
- Permissions
- Output directories
- Firefox extension ID

## 🌐 Publishing

ZIP files from `packed/` are ready for upload:

- [Firefox Add-ons](https://addons.mozilla.org/developers/) → `firefox-prod.zip`
- [Chrome Web Store](https://chrome.google.com/webstore/devconsole) → `chrome-prod.zip`
- [Opera Addons](https://addons.opera.com/developer/) → `opera-prod.zip`

## ⚠️ Important Notes

### Opera
Opera uses Chromium and requires manifest v3. If extension doesn't work:
1. Use `opera-dev` or `opera-prod` builds
2. Check console at `opera://extensions/`
3. Manifest v3 doesn't support `webRequestBlocking` - use `declarativeNetRequest` instead

### Manifest v3 (Chrome/Opera)
- `webRequest` is read-only
- Use `declarativeNetRequest` API for request modification
- Service Worker instead of persistent background scripts

## 📚 Documentation

- **[USAGE.md](USAGE.md)** - 🚀 Quick start and usage guide with local server
- **[СБОРКА.md](СБОРКА.md)** - 🔨 Quick build guide (Russian)
- **[BUILD_README.md](BUILD_README.md)** - 📖 Detailed build system documentation
- **[browserTracker/README.md](browserTracker/README.md)** - 🧩 Extension documentation
- **[serverVideoCapture/](serverVideoCapture/)** - 🖥️ Local server for data collection

## 🎯 Purpose

This developer tool is designed for:
- Web application debugging
- User activity monitoring
- Automated testing
- User session recording
- Behavior analysis

The extension tracks browser activity (tabs, URLs, cookies) and sends data to a local server (`http://localhost:8012`) for analysis and debugging.

## 🔧 Local Server

Server for activity recording is located in `serverVideoCapture/`:

```bash
cd serverVideoCapture
bun run index.ts
```

Server runs on `http://localhost:8012`

## ⚠️ Security

**This is a developer tool and should only be used in local development environment.**

- ❌ DO NOT install on production machines
- ❌ DO NOT use for regular users without their explicit consent
- ⚠️ Extension sends data including cookies to local server
- ✅ Use only for debugging on your own machine

## 📄 License

Internal use project.
