# Установка зависимостей для Web Panel

## 📦 Необходимые зависимости

### Для сервера (обязательно)

```bash
cd backendServer
bun add express ws
bun add -d @types/express @types/ws
```

### Для клиента (опционально, но рекомендуется)

```bash
bun add node-pty
bun add -d @types/node-pty
```

> **Примечание**: `node-pty` нужен для полноценной эмуляции PTY терминала. Если не установлен, будет использован fallback на `Bun.spawn` с ограниченным функционалом.

## 🚀 Быстрая установка

Выполните одну команду для установки всех зависимостей:

```bash
cd backendServer
bun add express ws node-pty
bun add -d @types/express @types/ws @types/node-pty
```

## ✅ Проверка установки

После установки зависимостей ошибки компиляции в WebPanel.ts должны исчезнуть.

Проверить можно запустив пример:

```bash
bun run backendServer/example-web-panel.ts
```

Должны увидеть:

```
🚀 Starting Remote Terminal System...

📡 Creating ClientCommunicator on port 8080...
🌐 Creating WebPanel on port 3000...

⏳ Starting servers...

✅ System is ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Dashboard:  http://localhost:3000
🔌 WS Server:  ws://localhost:8080
📡 API:        http://localhost:3000/api/clients
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 Troubleshooting

### Ошибка "Cannot find module 'express'"

Убедитесь что вы установили зависимости:

```bash
cd backendServer
bun add express ws
```

### Ошибка "Cannot find module 'node-pty'"

Это не критично. Система будет работать с fallback на Bun.spawn. Если хотите полный функционал PTY:

```bash
bun add node-pty
```

### Windows ошибки при установке node-pty

На Windows могут потребоваться дополнительные инструменты:

```bash
# Установить windows-build-tools (может потребовать admin права)
npm install --global windows-build-tools
```

Если установка не удалась, система всё равно будет работать с fallback механизмом.

## 📚 Дополнительная информация

- [WEB_PANEL_README.md](WEB_PANEL_README.md) - Полное руководство по веб-панели
- [QUICKSTART.md](QUICKSTART.md) - Быстрый старт
- [package.json](package.json) - Список всех зависимостей проекта

## 🎯 Следующие шаги

После установки зависимостей:

1. Запустите веб-панель: `bun run example-web-panel.ts`
2. Запустите клиент (в другом терминале): `bun run client.ts`
3. Откройте браузер: `http://localhost:3000`
4. Наслаждайтесь! 🚀
