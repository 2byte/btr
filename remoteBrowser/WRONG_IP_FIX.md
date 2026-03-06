# 🎯 Решение: Вижу свой IP вместо IP сервера

## Проблема

Вы подключаетесь к удалённому браузеру 81.24.214.134:9222, но при открытии 2ip.ru видите свой локальный IP, а не IP сервера.

## ❌ Что вы сделали неправильно

```bash
bun connect-existing.ts start
```

**Команда `start` запускает Chrome ЛОКАЛЬНО на вашей машине**, а не на удалённом сервере!

## ✅ Правильное решение

### 1. На удалённом сервере (через SSH)

```bash
# Подключитесь к серверу
ssh user@81.24.214.134

# Запустите Chrome на сервере
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --headless=new --no-sandbox &

# ИЛИ используйте автоматический скрипт
bash setup-remote-chrome.sh

# Откройте порт в файрволле
sudo ufw allow 9222/tcp

# Проверьте что Chrome запущен
ps aux | grep chrome
netstat -tuln | grep 9222

# Выйдите из SSH
exit
```

### 2. На локальной машине

```bash
# Проверьте доступность сервера
curl http://81.24.214.134:9222/json/version

# В коде host уже указан: "81.24.214.134"

# Подключитесь БЕЗ start!
bun connect-existing.ts
```

Теперь на 2ip.ru вы увидите IP сервера: **81.24.214.134** ✅

## 📋 Быстрая инструкция

### Вариант 1: Автоматическая настройка (рекомендуется)

```bash
# 1. Скопируйте скрипт на сервер
scp setup-remote-chrome.sh user@81.24.214.134:~

# 2. Запустите на сервере
ssh user@81.24.214.134 'bash setup-remote-chrome.sh'

# 3. Проверьте доступность
curl http://81.24.214.134:9222/json/version

# 4. Подключитесь (БЕЗ start!)
bun connect-existing.ts
```

### Вариант 2: Ручная настройка

```bash
# 1. SSH на сервер
ssh user@81.24.214.134

# 2. Установите Chrome (если нет)
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f

# 3. Запустите Chrome
google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0 --headless=new --no-sandbox &

# 4. Откройте порт
sudo ufw allow 9222/tcp

# 5. Выйдите
exit

# 6. На локальной машине - подключитесь
bun connect-existing.ts
```

### Вариант 3: SSH туннель (безопаснее)

```bash
# 1. На сервере запустите Chrome БЕЗ 0.0.0.0
ssh user@81.24.214.134
google-chrome --remote-debugging-port=9222 --headless=new &
exit

# 2. Создайте SSH туннель с локальной машины
ssh -L 9222:localhost:9222 user@81.24.214.134 -N -f

# 3. В коде измените на localhost
const host = "localhost";  // ← туннель
const port = 9222;

# 4. Подключитесь
bun connect-existing.ts
```

В этом случае:
- ✅ Порт 9222 не открыт в интернет (безопаснее)
- ✅ IP на 2ip.ru всё равно будет IP сервера
- ✅ Соединение идёт через зашифрованный SSH

## 🔍 Проверка

После настройки проверьте:

```bash
# 1. Chrome запущен на сервере
ssh user@81.24.214.134 'ps aux | grep chrome'

# 2. Слушает на всех интерфейсах
ssh user@81.24.214.134 'netstat -tuln | grep 9222'
# Должно быть: 0.0.0.0:9222

# 3. Доступен извне
curl http://81.24.214.134:9222/json/version

# 4. Подключение работает
bun connect-existing.ts info

# 5. IP правильный - откройте 2ip.ru
bun connect-existing.ts
# В логах найдите вкладку, откройте 2ip.ru через executeScript или вручную
```

## ⚠️ Важные различия

| Команда | Где запускается Chrome | IP на 2ip.ru |
|---------|----------------------|--------------|
| `bun connect-existing.ts start` | На вашей машине | Ваш IP ❌ |
| `bun connect-existing.ts` (после настройки сервера) | На сервере | IP сервера ✅ |

## 🎯 Ключевой момент

**`start` и `restart` ВСЕГДА запускают Chrome локально!**

Для удалённого браузера:
1. ✅ Запустите Chrome на сервере через SSH
2. ✅ Используйте только `bun connect-existing.ts` (БЕЗ start)

## 📚 Документация

- **[REMOTE_BROWSER_SETUP.md](REMOTE_BROWSER_SETUP.md)** - Полная инструкция по настройке
- **[setup-remote-chrome.sh](setup-remote-chrome.sh)** - Автоматический скрипт установки
- **[connect-existing.ts](connect-existing.ts)** - Скрипт подключения

## 🆘 Если не работает

См. раздел "Устранение проблем" в [REMOTE_BROWSER_SETUP.md](REMOTE_BROWSER_SETUP.md#-устранение-проблем)

---

**Итого: НЕ используйте `start` для удалённого браузера!**
