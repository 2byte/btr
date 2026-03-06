#!/bin/bash
# Скрипт для быстрой настройки удалённого браузера на сервере
# Запустите на сервере: bash setup-remote-chrome.sh

echo "🚀 Настройка удалённого Chrome для remote debugging"
echo ""

# Проверка что Chrome установлен
if ! command -v google-chrome &> /dev/null; then
    echo "❌ Chrome не установлен!"
    echo ""
    echo "Установите Chrome:"
    echo "  Ubuntu/Debian:"
    echo "    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
    echo "    sudo dpkg -i google-chrome-stable_current_amd64.deb"
    echo "    sudo apt-get install -f"
    echo ""
    echo "  CentOS/RHEL:"
    echo "    wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm"
    echo "    sudo yum install -y google-chrome-stable_current_x86_64.rpm"
    exit 1
fi

echo "✅ Chrome найден: $(google-chrome --version)"
echo ""

# Порт для remote debugging
PORT=${1:-9222}
echo "🔌 Использую порт: $PORT"
echo ""

# Создание systemd service
echo "📝 Создание systemd service..."

sudo tee /etc/systemd/system/chrome-remote.service > /dev/null <<EOF
[Unit]
Description=Chrome Remote Debugging
After=network.target

[Service]
Type=simple
User=$USER
Environment="DISPLAY=:99"
ExecStart=/usr/bin/google-chrome \\
  --remote-debugging-port=$PORT \\
  --remote-debugging-address=0.0.0.0 \\
  --headless=new \\
  --no-sandbox \\
  --disable-dev-shm-usage \\
  --disable-gpu \\
  --user-data-dir=/home/$USER/.chrome-remote
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service создан: /etc/systemd/system/chrome-remote.service"
echo ""

# Создание директории для user data
mkdir -p ~/.chrome-remote
echo "✅ Директория создана: ~/.chrome-remote"
echo ""

# Перезагрузка systemd
echo "🔄 Перезагрузка systemd..."
sudo systemctl daemon-reload

# Включение автозапуска
echo "🔧 Включение автозапуска..."
sudo systemctl enable chrome-remote

# Запуск службы
echo "▶️  Запуск Chrome..."
sudo systemctl start chrome-remote

# Ожидание запуска
sleep 3

# Проверка статуса
echo ""
echo "📊 Статус службы:"
sudo systemctl status chrome-remote --no-pager | head -n 10

# Проверка порта
echo ""
echo "🔍 Проверка порта $PORT:"
if netstat -tuln | grep -q ":$PORT "; then
    echo "✅ Chrome слушает на порту $PORT"
else
    echo "❌ Chrome не слушает на порту $PORT"
    echo "Проверьте логи: sudo journalctl -u chrome-remote -n 50"
    exit 1
fi

# Настройка файрволла
echo ""
echo "🔥 Настройка файрволла..."

if command -v ufw &> /dev/null; then
    echo "Используется UFW"
    sudo ufw allow $PORT/tcp
    echo "✅ Порт $PORT открыт в UFW"
elif command -v firewall-cmd &> /dev/null; then
    echo "Используется firewalld"
    sudo firewall-cmd --permanent --add-port=$PORT/tcp
    sudo firewall-cmd --reload
    echo "✅ Порт $PORT открыт в firewalld"
else
    echo "⚠️  Файрволл не найден. Откройте порт вручную!"
fi

# Получение IP адреса
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📋 Информация для подключения:"
echo "   Host: $IP"
echo "   Port: $PORT"
echo ""
echo "🔧 Измените в connect-existing.ts:"
echo "   const host = \"$IP\";"
echo "   const port = $PORT;"
echo ""
echo "✅ Проверьте доступность (с локальной машины):"
echo "   curl http://$IP:$PORT/json/version"
echo ""
echo "🔌 Подключитесь:"
echo "   bun connect-existing.ts"
echo ""
echo "📚 Управление сервисом:"
echo "   sudo systemctl start chrome-remote    # Запустить"
echo "   sudo systemctl stop chrome-remote     # Остановить"
echo "   sudo systemctl restart chrome-remote  # Перезапустить"
echo "   sudo systemctl status chrome-remote   # Статус"
echo "   sudo journalctl -u chrome-remote -f   # Логи"
echo ""
