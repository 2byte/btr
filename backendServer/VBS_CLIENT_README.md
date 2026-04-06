# VBS Scripts for Hidden Client Execution

Скрипты для скрытого запуска WebSocket клиента на Windows.

## Файлы

### 1. `run_hidden.vbs` - Универсальный скрипт
Универсальный VBS скрипт для скрытого запуска любых команд.

**Способы использования:**

#### Вариант 1: С аргументами командной строки
```cmd
cscript //nologo run_hidden.vbs "bun.exe" "dist-clients\client.ts"
```

#### Вариант 2: Редактировать и запустить двойным кликом
Откройте `run_hidden.vbs` и измените секцию CONFIGURATION:
```vbs
CMD_EXECUTABLE = "bun.exe"
CMD_ARGS = "dist-clients\client.ts"
WORKING_DIRECTORY = scriptDir
LOG_ENABLED = True
```

#### Вариант 3: Из другого скрипта
```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "run_hidden.vbs ""bun.exe"" ""script.ts""", 0, False
```

**Параметры:**
- `CMD_EXECUTABLE` - исполняемый файл (bun.exe, node.exe, python.exe, и т.д.)
- `CMD_ARGS` - аргументы командной строки
- `WORKING_DIRECTORY` - рабочая директория (по умолчанию: папка скрипта)
- `LOG_ENABLED` - включить/выключить логирование (True/False)
- `LOG_DIRECTORY` - папка для логов (по умолчанию: .\logs)

**Логи:**
Логи сохраняются в формате: `logs\hidden_run_YYYY-MM-DD_HH-MM-SS.log`

---

### 2. `start_client_hidden.vbs` - Запуск клиента
Специализированный скрипт для запуска WebSocket клиента.

**Использование:**
Просто двойной клик по файлу или:
```cmd
start_client_hidden.vbs
```

**Что делает:**
- Ищет bun.exe в нескольких местах:
  - `node_modules\.bin\bun.exe`
  - `..\serverVideoCapture\runtime\bun.exe`
  - `C:\Program Files\Bun\bun.exe`
  - системный PATH
- Запускает `dist-clients\client.ts` скрыто
- Создает лог файл в `logs\client_YYYY-MM-DD.log`

**Логи:**
Все выходные данные (stdout/stderr) сохраняются в дневной лог файл.

---

### 3. `stop_client.vbs` - Остановка клиента
Скрипт для остановки всех запущенных процессов клиента.

**Использование:**
```cmd
stop_client.vbs
```

**Что делает:**
- Находит все процессы `bun.exe` с `client.ts` в командной строке
- Завершает их принудительно
- Логирует результаты в `logs\client_stop_YYYY-MM-DD.log`

---

### 4. `watchdog_client.vbs` - Автоперезапуск клиента
Скрипт для мониторинга и автоматического перезапуска клиента при сбое.

**Использование:**
```cmd
watchdog_client.vbs
```

**Что делает:**
- Проверяет каждые 30 секунд, запущен ли клиент
- Автоматически перезапускает клиент если процесс упал
- Защита от бесконечного цикла перезапусков (максимум 10 раз в час)
- Логирует все события в `logs\watchdog_YYYY-MM-DD.log`

**Конфигурация (в начале файла):**
```vbs
CHECK_INTERVAL_SECONDS = 30    ' Интервал проверки
MAX_RESTARTS_PER_HOUR = 10     ' Максимум перезапусков в час
RESTART_DELAY_SECONDS = 5      ' Задержка перед перезапуском
```

**Рекомендуется для продакшн использования!**

---

### 6. `install_autostart.bat` - Установка автозапуска
Автоматически создает задачу в планировщике задач Windows.

**Использование:**
```cmd
install_autostart.bat
```
*(Требуются права администратора)*

**Возможности:**
- Выбор режима: Client only или Watchdog (рекомендуется)
- Автоматическое создание задачи в планировщике
- Запуск от имени системы
- Проверка работы после установки

---

### 7. `uninstall_autostart.bat` - Удаление автозапуска
Удаляет задачи автозапуска из планировщика задач.

**Использование:**
```cmd
uninstall_autostart.bat
```
*(Требуются права администратора)*

---

### 5. `client_manager.bat` - Интерактивное меню
Удобный BAT файл с меню для управления клиентом.

**Использование:**
```cmd
client_manager.bat
```

**Возможности:**
- Запуск клиента (скрыто или в консоли)
- Остановка клиента
- Просмотр логов
- Очистка логов
- Проверка статуса

---

## Примеры использования

### Запуск клиента
```cmd
:: Способ 1: Специализированный скрипт
start_client_hidden.vbs

:: Способ 2: Универсальный скрипт
run_hidden.vbs bun.exe dist-clients\client.ts
```

### Остановка клиента
```cmd
stop_client.vbs
```

### Другие команды через универсальный скрипт
```cmd
:: Запуск Node.js скрипта
run_hidden.vbs node.exe server.js

:: Запуск Python скрипта
run_hidden.vbs python.exe script.py

:: Запуск PowerShell команды
run_hidden.vbs powershell.exe "-File script.ps1"

:: Запуск команды с указанием рабочей директории
run_hidden.vbs bun.exe "test.ts" "C:\Projects\MyApp"
```

---

## Автозапуск при старте Windows

### ⚡ Быстрая установка (рекомендуется)

Запустите от имени администратора:
```cmd
install_autostart.bat
```

Выберите режим:
- **[1] Client only** - запускает только клиент
- **[2] Watchdog** - запускает watchdog (автоперезапуск при сбое) ✅ Рекомендуется

Для удаления:
```cmd
uninstall_autostart.bat
```

---

### Рекомендуемый способ: Watchdog в планировщике задач

**Это наилучший вариант для продакшн!** Watchdog автоматически перезапустит клиент если он упадет.

1. Откройте Планировщик задач (Task Scheduler)
2. Создайте новую задачу:
   - **Имя:** Client Watchdog
   - **Триггер:** При входе в систему
   - **Действие:** Запустить программу
   - **Программа:** `wscript.exe`
   - **Аргументы:** `"C:\полный\путь\к\watchdog_client.vbs"`
   - **Начать в:** `C:\полный\путь\к\backendServer`
   - **Запускать:** Скрыто
3. Дополнительно:
   - ☑ Запускать независимо от входа пользователя в систему
   - ☑ Выполнять с наивысшими правами (если нужно)
   - ☑ Скрытый режим

### Способ 1: Через планировщик задач
1. Откройте Планировщик задач (Task Scheduler)
2. Создайте новую задачу:
   - **Триггер:** При входе в систему
   - **Действие:** Запустить программу
   - **Программа:** `wscript.exe`
   - **Аргументы:** `"C:\полный\путь\к\start_client_hidden.vbs"`
   - **Запускать:** Скрыто
3. Дополнительно:
   - ☑ Запускать с наивысшими правами (если нужно)
   - ☑ Запускать независимо от входа пользователя в систему

### Способ 2: Через реестр
```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run]
"ClientHidden"="wscript.exe \"C:\\полный\\путь\\к\\start_client_hidden.vbs\""
```

Сохраните как `autostart.reg` и запустите.

### Способ 3: Через папку автозагрузки
Создайте ярлык на `start_client_hidden.vbs` в:
```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

---

## Проверка работы

### Проверить запущен ли клиент
```cmd
tasklist | findstr bun.exe
```

или

```powershell
Get-Process | Where-Object {$_.ProcessName -eq "bun" -and $_.CommandLine -like "*client.ts*"}
```

### Посмотреть логи
```cmd
type logs\client_2026-03-07.log
```

или в реальном времени:
```powershell
Get-Content -Path "logs\client_2026-03-07.log" -Wait -Tail 50
```

---

## Переменные окружения

Клиент поддерживает переменные окружения:

```cmd
:: Перед запуском установите переменные
set WS_URL=ws://my-server.com:8080
set API_TOKEN=my-secret-token
set CLIENT_NAME=office-pc

:: Затем запустите
start_client_hidden.vbs
```

Или создайте файл `.env` в папке `backendServer`:
```env
WS_URL=ws://my-server.com:8080
API_TOKEN=my-secret-token
CLIENT_NAME=office-pc
```

---

## Устранение неполадок

### Клиент не запускается
1. Проверьте логи в папке `logs\`
2. Убедитесь что bun.exe установлен и доступен
3. Проверьте что файл `dist-clients\client.ts` существует

### Клиент запускается но не подключается
1. Проверьте переменные окружения `WS_URL` и `API_TOKEN`
2. Проверьте доступность сервера
3. Проверьте логи клиента

### Процесс не останавливается
```cmd
:: Принудительная остановка всех bun процессов
taskkill /F /IM bun.exe

:: Или через PowerShell
Stop-Process -Name bun -Force
```

---

## Безопасность

⚠️ **Важно:**
- Логи могут содержать чувствительную информацию
- Регулярно очищайте папку `logs\`
- Храните `API_TOKEN` в безопасности
- Не передавайте VBS скрипты с встроенными токенами

---

## Дополнительно

### Отключить логирование
В `run_hidden.vbs` измените:
```vbs
LOG_ENABLED = False
```

### Изменить папку логов
```vbs
LOG_DIRECTORY = "C:\MyLogs"
```

### Запуск с таймаутом
Если нужно запустить процесс и автоматически завершить через N секунд:
```cmd
run_hidden.vbs bun.exe "dist-clients\client.ts"
timeout /t 3600 /nobreak
stop_client.vbs
```
