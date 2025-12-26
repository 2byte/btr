# Browser Tracker - Build System

**Developer tool** for debugging and tracking browser activity on local server.

Build system for creating browser extensions for different browsers using TypeScript and Bun.js.

## Supported Browsers
- **Firefox** (Desktop & Mobile)
- **Chrome** (Desktop)
- **Opera** (Desktop)
- **WebKit/Safari** (uses Chrome build)

## Installation

Убедитесь, что у вас установлен [Bun](https://bun.sh/):
```bash
# Windows
powershell -c "irm bun.sh/install.ps1 | iex"

# Linux/macOS
curl -fsSL https://bun.sh/install | bash
```

## Build Configurations

### Firefox
- **firefox-dev** - Manifest v2 with popup (development)
- **firefox-prod** - Manifest v2 without popup (production)

### Chrome
- **chrome-dev** - Manifest v3 with popup (development)
- **chrome-prod** - Manifest v3 without popup (production)

### Opera
- **opera-dev** - Manifest v3 with popup (development)
- **opera-prod** - Manifest v3 without popup (production)

> **Note:** Opera uses Chromium, so configuration is identical to Chrome.

## Usage

### Build all versions
```bash
bun run build
```

### Build specific version
```bash
# Firefox dev
bun run build:firefox-dev

# Firefox prod
bun run build:firefox-prod

# Chrome dev
bun run build:chrome-dev

# Chrome prod
bun run build:chrome-prod

# Opera dev
bun run build:opera-dev

# Opera prod
bun run build:opera-prod
```

### Build multiple versions
```bash
bun run build.ts firefox-dev chrome-dev opera-dev
```

### Clean builds
```bash
bun run clean
```

### Pack extensions to ZIP
After building, you can pack all versions to zip archives:
```bash
# Pack only (requires prior build)
bun run pack

# Build and pack in one command
bun run build:pack
```

ZIP files will be created in `packed/` directory.

## Output Structure

Все сборки сохраняются в директории `dist/`:

```
dist/
├── firefox-dev/
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   └── icons/
├── firefox-prod/
│   ├── manifest.json
│   ├── background.js
│   └── icons/
├── chrome-dev/
├── chrome-prod/
├── opera-dev/
└── opera-prod/

packed/
├── firefox-dev.zip
├── firefox-prod.zip
├── chrome-dev.zip
├── chrome-prod.zip
├── opera-dev.zip
└── opera-prod.zip
```

## Version Differences

### Manifest v2 (Firefox)
- Uses `browser_action` for popup
- Supports `webRequest` with blocking
- Includes `browser_specific_settings` for Firefox

### Manifest v3 (Chrome/Opera)
- Uses `action` instead of `browser_action`
- Service Worker instead of background scripts
- `host_permissions` instead of URLs in `permissions`
- ⚠️ **Important:** `webRequestBlocking` is no longer supported, use `declarativeNetRequest`

### Production vs Development
- **Development** - includes popup.html and popup.js for debugging
- **Production** - no popup, background operation only

## Configuration

Configurations are located in [build.config.ts](build.config.ts). You can customize:
- Extension name and version
- Permissions
- Output directories
- Firefox extension ID

Example:
```typescript
"firefox-dev": {
  name: "Browser Tracker Dev",
  version: "1.0.0",
  manifestVersion: 2,
  outputDir: "dist/firefox-dev",
  includePopup: true,
  permissions: [
    "tabs",
    "storage",
    // ...
  ]
}
```

## Installing Extension

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` file from `dist/firefox-dev/` or `dist/firefox-prod/`

### Chrome/Opera
1. Open `chrome://extensions/` (or `opera://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select directory `dist/chrome-dev/` or `dist/opera-dev/`

### Safari/WebKit
1. Use Chrome build (`dist/chrome-dev/`)
2. In Safari: Develop → Show Extension Builder
3. Click + → Add Extension
4. Select folder `dist/chrome-dev/`

Or use command line converter:
```bash
xcrun safari-web-extension-converter dist/chrome-dev/ --app-name "Browser Tracker"
```

## Packaging for Publishing

ZIP files are created automatically with `bun run pack` or `bun run build:pack`.

Ready archives are in `packed/` directory:
- `firefox-prod.zip` - for [Firefox Add-ons](https://addons.mozilla.org/developers/)
- `chrome-prod.zip` - for [Chrome Web Store](https://chrome.google.com/webstore/devconsole)
- `opera-prod.zip` - for [Opera Addons](https://addons.opera.com/developer/)

### Alternative Firefox packaging

Use [web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/):
```bash
cd dist/firefox-prod
npx web-ext build
```

## Troubleshooting

### Opera doesn't work
Opera uses same API as Chrome (Chromium). If extension doesn't work:
1. Make sure you're using manifest v3
2. Check extension console for errors
3. Manifest v3 requires `declarativeNetRequest` instead of `webRequest` with blocking

### Manifest v3 webRequest
In manifest v3, `webRequest` is read-only. Use `declarativeNetRequest` for request modification.

## Future Development

- [ ] Add `declarativeNetRequest` support for manifest v3
- [ ] Automatic .zip archive creation
- [ ] JavaScript minification
- [ ] Source maps for debugging
- [ ] Automatic signing for Firefox
