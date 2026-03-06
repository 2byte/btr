# 🌐 Подключение к удалённому браузеру

## Проблема

Вы подключаетесь к браузеру на удалённом сервере (например, 81.24.214.134:9222), но когда открываете 2ip.ru, видите свой локальный IP, а не IP сервера.

**Причина:** Команды `start` и `restart` запускают Chrome **локально** на вашей машине, а не на удалённом сервере.

## ✅ Правильная настройка

### Шаг 1: Настройка на удалённом сервере

Подключитесь к серверу по SSH:
```bash
ssh user@81.24.214.134
```

Запустите Chrome на сервере с remote debugging:
```bash
# Linux
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --no-sandbox --headless=new

# Или с GUI (если есть X-сервер)
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
```

**Важные параметры:**
- `--remote-debugging-port=9222` - порт для отладки
- `--remote-debugging-address=0.0.0.0` - слушать на всех интерфейсах (не только localhost)
- `--headless=new` - без GUI (для серверов)
- `--no-sandbox` - нужно если запускаете от root

### Шаг 2: Откройте порт в файрволле

На сервере откройте порт 9222:

**UFW (Ubuntu/Debian):**
```bash
sudo ufw allow 9222/tcp
sudo ufw reload
```

**Firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-port=9222/tcp
sudo firewall-cmd --reload
```

**iptables:**
```bash
sudo iptables -A INPUT -p tcp --dport 9222 -j ACCEPT
sudo iptables-save
```

### Шаг 3: Проверка доступности

С вашей локальной машины проверьте:
```bash
curl http://81.24.214.134:9222/json/version
```

Должен вернуться JSON с информацией о браузере.

### Шаг 4: Укажите IP сервера в коде

Откройте [connect-existing.ts](connect-existing.ts#L280) и измените:

```typescript
// CLI
if (import.meta.main) {
  const command = Bun.argv[2];

  const host = "81.24.214.134"; // ← IP вашего сервера
  const port = 9222;
  
  // ...
}
```

### Шаг 5: Подключитесь (БЕЗ start!)

```bash
# Просто подключитесь к уже запущенному браузеру на сервере
bun connect-existing.ts

# НЕ используйте start! (это запустит локальный браузер)
# bun connect-existing.ts start  ❌ НЕПРАВИЛЬНО
```

Теперь при открытии 2ip.ru вы увидите IP сервера (81.24.214.134)!

## 🔒 Безопасность

### Вариант 1: SSH туннель (рекомендуется)

Вместо открытия порта в интернет, используйте SSH туннель:

```bash
# На локальной машине создайте туннель
ssh -L 9222:localhost:9222 user@81.24.214.134

# Теперь в коде используйте
const host = "localhost";
const port = 9222;
```

На сервере запускайте Chrome без `--remote-debugging-address`:
```bash
google-chrome --remote-debugging-port=9222 --headless=new
```

Теперь порт 9222 закрыт извне, но доступен через SSH туннель.

### Вариант 2: VPN

Подключитесь к серверу через VPN, тогда можно использовать внутренний IP.

### Вариант 3: Nginx с авторизацией

Поставьте Nginx перед Chrome и добавьте HTTP Basic Auth:

```nginx
server {
    listen 9223;
    
    location / {
        auth_basic "Chrome Debugger";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://localhost:9222;
    }
}
```

## 🐳 Docker вариант

Запустите Chrome в Docker на сервере:

```bash
docker run -d \
  --name chrome-remote \
  -p 9222:9222 \
  zenika/alpine-chrome:latest \
  --no-sandbox \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222
```

## 🔧 Автозапуск на сервере

### Systemd service

Создайте `/etc/systemd/system/chrome-remote.service`:

```ini
[Unit]
Description=Chrome Remote Debugging
After=network.target

[Service]
Type=simple
User=chrome-user
Environment="DISPLAY=:99"
ExecStart=/usr/bin/google-chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --headless=new \
  --no-sandbox \
  --disable-dev-shm-usage
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Запустите:
```bash
sudo systemctl daemon-reload
sudo systemctl enable chrome-remote
sudo systemctl start chrome-remote
```

### Screen/tmux

Простой вариант:
```bash
screen -dmS chrome google-chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=0.0.0.0 \
  --headless=new

# Или tmux
tmux new -d -s chrome 'google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --headless=new'
```

## 📊 Проверка работы

### 1. Проверьте что браузер запущен на сервере
```bash
ssh user@81.24.214.134 'ps aux | grep chrome'
```

### 2. Проверьте порт на сервере
```bash
ssh user@81.24.214.134 'netstat -tulpn | grep 9222'
```

Должно быть: `0.0.0.0:9222` (слушает на всех интерфейсах)

### 3. Проверьте доступность извне
```bash
# С локальной машины
curl http://81.24.214.134:9222/json/version
```

### 4. Проверьте IP в браузере
```bash
# После подключения
bun connect-existing.ts

# Откройте 2ip.ru в одной из вкладок и проверьте IP
```

## 🐛 Устранение проблем

### "Connection refused"
- Браузер не запущен на сервере
- Порт закрыт в файрволле
- Используется `localhost` вместо `0.0.0.0`

### "Вижу свой IP на 2ip.ru"
- Вы запустили локальный браузер командой `start`
- Используйте только подключение к уже запущенному на сервере

### "No route to host"
- Проверьте файрволл на сервере
- Проверьте файрволл провайдера (Security Groups в AWS/VPS)

### "Connection timeout"
- Сервер недоступен
- Неправильный IP адрес
- Заблокирован на уровне провайдера

## 📝 Итоговая инструкция

```bash
# 1. НА СЕРВЕРЕ: Запустите Chrome
ssh user@81.24.214.134
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --headless=new &
exit

# 2. НА СЕРВЕРЕ: Откройте порт
ssh user@81.24.214.134
sudo ufw allow 9222/tcp
exit

# 3. НА ЛОКАЛЬНОЙ МАШИНЕ: Проверьте доступность
curl http://81.24.214.134:9222/json/version

# 4. НА ЛОКАЛЬНОЙ МАШИНЕ: Измените host в коде на "81.24.214.134"

# 5. НА ЛОКАЛЬНОЙ МАШИНЕ: Подключитесь (БЕЗ start!)
bun connect-existing.ts

# 6. Проверьте IP: откройте 2ip.ru в браузере - должен быть 81.24.214.134
```

## 🎯 Ключевые различия

| Действие | Локальный браузер | Удалённый браузер |
|----------|-------------------|-------------------|
| Запуск | `bun connect-existing.ts start` | SSH на сервер + запуск Chrome |
| Host в коде | `localhost` | `81.24.214.134` |
| IP на 2ip.ru | Ваш локальный IP | IP сервера |
| Открытие портов | Не нужно | Нужно в файрволле |
| SSH туннель | Не нужен | Рекомендуется |

---

**Итого:** НЕ используйте `start`/`restart` для удалённого браузера - они всегда запускают локально!
