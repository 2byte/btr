# 🖥️ VNC Setup для полноценного GUI доступа

## Зачем нужен VNC?

VNC (Virtual Network Computing) даёт **полноценный доступ к рабочему столу** удалённого сервера, в отличие от Chrome DevTools Inspector, который только показывает содержимое вкладок.

### VNC vs Chrome DevTools

| Функция | Chrome DevTools | VNC |
|---------|----------------|-----|
| Просмотр вкладок | ✅ | ✅ |
| Взаимодействие с элементами | ✅ | ✅ |
| **Диалоги выбора файлов** | ❌ | ✅ |
| **Системные диалоги** | ❌ | ✅ |
| **Адресная строка браузера** | ❌ | ✅ |
| **Вкладки браузера** | ❌ | ✅ |
| **Расширения Chrome** | ❌ | ✅ |
| **Контекстные меню** | ❌ | ✅ |
| Выполнение JavaScript | ✅ | ✅ |
| Network, Console | ✅ | ✅ |

**Используйте VNC, если вам нужно:**
- Загружать файлы через диалоги выбора файлов
- Открывать новые вкладки естественным способом
- Использовать расширения Chrome
- Полноценно работать как с локальным браузером

## 🚀 Установка VNC на сервере

### Вариант 1: TigerVNC (рекомендуется)

```bash
# Подключитесь к серверу
ssh user@81.24.214.134

# Установите TigerVNC и Desktop Environment
sudo apt update
sudo apt install -y tigervnc-standalone-server xfce4 xfce4-goodies

# Настройте пароль VNC
vncpasswd
# Введите пароль (минимум 6 символов)

# Создайте конфиг для VNC
mkdir -p ~/.vnc
nano ~/.vnc/xstartup
```

**Содержимое `~/.vnc/xstartup`:**
```bash
#!/bin/bash
xrdb $HOME/.Xresources
startxfce4 &
```

**Сделайте скрипт исполняемым:**
```bash
chmod +x ~/.vnc/xstartup
```

**Запустите VNC сервер:**
```bash
vncserver :1 -geometry 1920x1080 -depth 24
```

Сервер запустится на порту **5901** (display :1 = port 5900+1 = 5901)

### Вариант 2: x11vnc (для существующего X сервера)

Если на сервере уже запущен X сервер (GUI):

```bash
sudo apt install -y x11vnc

# Установите пароль
x11vnc -storepasswd

# Запустите x11vnc для текущего дисплея
x11vnc -display :0 -auth guess -forever -loop -noxdamage -repeat -rfbauth ~/.vnc/passwd -rfbport 5900 -shared
```

## 🔐 Безопасность - SSH туннель

**НЕ открывайте порт VNC напрямую в интернет!** Используйте SSH туннель.

### На локальной машине (Windows):

```bash
ssh -L 5901:localhost:5901 user@81.24.214.134
```

Оставьте это соединение открытым!

### На локальной машине (PowerShell):

```powershell
ssh -L 5901:localhost:5901 user@81.24.214.134
```

## 🖥️ Подключение VNC клиента

### Windows - TightVNC Viewer

1. **Скачайте:** https://www.tightvnc.com/download.php
2. **Установите** TightVNC Viewer (только viewer, не server)
3. **Запустите** TightVNC Viewer
4. **Введите адрес:** `localhost:5901` (или `localhost::5901`)
5. **Введите пароль** из `vncpasswd`

### Windows - встроенный VNC клиент

Windows 10/11 имеет встроенную поддержку VNC через Remote Desktop:

1. Нажмите **Win + R**
2. Введите: `mstsc /v:localhost:5901`
3. (Не всегда работает, используйте TightVNC)

### macOS - Screen Sharing

```bash
# В терминале создайте SSH туннель
ssh -L 5901:localhost:5901 user@81.24.214.134

# Затем в Finder
⌘ + K → vnc://localhost:5901
```

### Linux - Remmina, Vinagre, или vncviewer

```bash
# Remmina (GUI)
sudo apt install remmina
remmina  # File → New → VNC → localhost:5901

# Vinagre (GNOME)
sudo apt install vinagre
vinagre localhost:5901

# vncviewer (командная строка)
sudo apt install tigervnc-viewer
vncviewer localhost:5901
```

## 🌐 Запуск Chrome в VNC сессии

После подключения через VNC:

```bash
# В терминале VNC сессии
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 &
```

Теперь у вас:
- ✅ Полноценный GUI Chrome через VNC
- ✅ Remote debugging для Selenium на порту 9222
- ✅ Возможность загружать файлы через диалоги
- ✅ Все расширения и функции Chrome

## 🔄 Автозапуск VNC при загрузке сервера

Создайте systemd service:

```bash
sudo nano /etc/systemd/system/vncserver@.service
```

**Содержимое:**
```ini
[Unit]
Description=Start TigerVNC server at startup
After=syslog.target network.target

[Service]
Type=forking
User=YOUR_USERNAME
Group=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME

ExecStartPre=-/usr/bin/vncserver -kill :%i > /dev/null 2>&1
ExecStart=/usr/bin/vncserver -depth 24 -geometry 1920x1080 :%i
ExecStop=/usr/bin/vncserver -kill :%i

[Install]
WantedBy=multi-user.target
```

**Замените `YOUR_USERNAME` на ваше имя пользователя!**

**Активируйте:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable vncserver@1.service
sudo systemctl start vncserver@1.service

# Проверьте статус
sudo systemctl status vncserver@1.service
```

## 📋 Полный workflow с VNC

```bash
# === НА СЕРВЕРЕ ===
ssh user@81.24.214.134

# Запустите VNC (если не автозапуск)
vncserver :1 -geometry 1920x1080 -depth 24

# === НА ЛОКАЛЬНОЙ МАШИНЕ ===

# Терминал 1: SSH туннель
ssh -L 5901:localhost:5901 user@81.24.214.134

# VNC клиент: Подключитесь к localhost:5901

# === В VNC СЕССИИ ===

# Откройте терминал и запустите Chrome
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 &

# === ТЕПЕРЬ У ВАС ЕСТЬ: ===

1. Полноценный Chrome GUI через VNC
2. Можете загружать файлы через диалоги
3. Можете использовать Selenium для автоматизации:
   bun connect-existing.ts
4. Можете использовать chrome://inspect для DevTools
```

## 🛠️ Управление VNC сессиями

```bash
# Посмотреть запущенные VNC сессии
vncserver -list

# Остановить VNC сервер
vncserver -kill :1

# Перезапустить VNC сервер
vncserver -kill :1
vncserver :1 -geometry 1920x1080 -depth 24

# Изменить разрешение
vncserver :1 -geometry 2560x1440 -depth 24
```

## 🔧 Troubleshooting

### Проблема: "Connection refused"

```bash
# Проверьте, запущен ли VNC сервер
vncserver -list

# Проверьте порты
netstat -tlnp | grep vnc

# Проверьте SSH туннель
# На локальной машине:
netstat -an | findstr 5901  # Windows
netstat -an | grep 5901     # Linux/Mac
```

### Проблема: "Authentication failed"

```bash
# Переустановите пароль
vncpasswd
# Затем перезапустите VNC сервер
vncserver -kill :1
vncserver :1 -geometry 1920x1080 -depth 24
```

### Проблема: "Grey screen" или "Desktop not loading"

```bash
# Проверьте ~/.vnc/xstartup
cat ~/.vnc/xstartup

# Должен быть исполняемым
chmod +x ~/.vnc/xstartup

# Проверьте логи
cat ~/.vnc/*.log
```

### Проблема: Медленная работа VNC

```bash
# Уменьшите глубину цвета
vncserver :1 -geometry 1920x1080 -depth 16

# Используйте компрессию в VNC клиенте
# TightVNC: Options → Enable compression
```

## 🎯 Когда использовать VNC vs DevTools

**Используйте Chrome DevTools Inspector (`chrome://inspect`):**
- ✅ Быстрый просмотр и отладка страниц
- ✅ Не нужно загружать файлы
- ✅ Легковесное подключение
- ✅ Network inspector, Console, Sources

**Используйте VNC:**
- ✅ Нужно загружать файлы через диалоги
- ✅ Нужны все фичи Chrome (расширения, контекстные меню)
- ✅ Нужно видеть системные диалоги
- ✅ Комфортная работа как с локальным браузером

## 💡 Совет: Комбинированный подход

Можно использовать **оба метода одновременно**:

1. **VNC** - для работы с файлами и полноценного GUI
2. **chrome://inspect** - для быстрого доступа к DevTools и отладки
3. **Selenium** - для автоматизации и программного управления

Все три метода работают с одним и тем же браузером на порту 9222!

---

**Для максимального комфорта - используйте VNC! 🚀**
