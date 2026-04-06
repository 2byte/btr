# Quick Start - Client Hidden Launch

## 🚀 Быстрый старт (5 секунд)

### Разовый запуск
```cmd
start_client_hidden.vbs
```

### Остановка
```cmd
stop_client.vbs
```

---

## 📋 Меню управления
```cmd
client_manager.bat
```

---

## ⚙️ Автозапуск (с защитой от сбоев)

**Один раз настроить, работает всегда:**

```cmd
install_autostart.bat
```

Выбери **[2] Watchdog** для автоматического перезапуска при сбоях.

---

## 📂 Структура файлов

```
backendServer/
├── run_hidden.vbs              # Универсальный скрипт (любые команды)
├── start_client_hidden.vbs     # Запуск клиента
├── stop_client.vbs             # Остановка клиента
├── watchdog_client.vbs         # Автоперезапуск при сбое
├── client_manager.bat          # Интерактивное меню
├── install_autostart.bat       # Установка автозапуска
├── uninstall_autostart.bat     # Удаление автозапуска
└── logs/                       # Логи всех операций
    ├── client_YYYY-MM-DD.log
    ├── watchdog_YYYY-MM-DD.log
    └── ...
```

---

## 🔍 Проверка работы

### Способ 1: Через task manager
```
Ctrl+Shift+Esc → вкладка "Подробности" → найти bun.exe
```

### Способ 2: Через командную строку
```cmd
tasklist | findstr bun.exe
```

### Способ 3: Логи
```cmd
type logs\client_2026-03-07.log
```

---

## 🛠️ Настройка

### Изменить сервер подключения:
Создай файл `.env` в папке `backendServer`:
```env
WS_URL=ws://your-server.com:8080
API_TOKEN=your-secret-token
CLIENT_NAME=my-client-name
```

или установи переменные окружения Windows.

---

## ❓ Проблемы?

### Клиент не запускается
1. Проверь логи в `logs\`
2. Убедись что bun установлен
3. Проверь что файл `dist-clients\client.ts` существует

### Нужна помощь?
Читай полную документацию: `VBS_CLIENT_README.md`

---

## 🎯 One-liner для быстрого деплоя

```cmd
cd backendServer && install_autostart.bat
```

Выбери **[2] Watchdog** → готово! Клиент будет работать всегда.
