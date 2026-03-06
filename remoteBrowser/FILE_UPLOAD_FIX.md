# 🚀 Быстрое решение: Загрузка файлов в удалённом браузере

## Проблема

При использовании **Chrome DevTools Inspector** (`chrome://inspect`) для просмотра удалённого браузера:
- ❌ Диалоги выбора файлов не работают
- ❌ При клике на `<input type="file">` диалог открывается, но выбор файла игнорируется
- ❌ Форма не получает выбранный файл

Это **известное ограничение Chrome DevTools Protocol** при удалённом подключении.

## ✅ Решение 1: Программная загрузка (быстро)

### Шаг 1: Загрузите файл на сервер

```bash
# Скопируйте файл на сервер, где запущен Chrome
scp C:\Users\user\document.pdf user@81.24.214.134:/tmp/upload.pdf
```

### Шаг 2: Загрузите файл программно

```bash
# Используйте готовый скрипт
bun upload-file.ts 'input#file' '/tmp/upload.pdf'

# Или с явным указанием хоста/порта
bun upload-file.ts 'input[name="avatar"]' '/home/user/image.png' 81.24.214.134 9222
```

**Скрипт автоматически:**
- Подключается к удалённому браузеру
- Находит элемент input по селектору
- Загружает файл, **обходя диалоговое окно**

### Примеры использования

```bash
# По ID
bun upload-file.ts 'input#avatar' '/tmp/avatar.png'

# По name
bun upload-file.ts 'input[name="file"]' '/home/user/doc.pdf'

# По class
bun upload-file.ts 'input.file-upload' '/tmp/image.jpg'

# Несколько файлов (в коде)
# См. примеры в README.md
```

### Как найти селектор?

1. Откройте `chrome://inspect`
2. Нажмите **inspect** на нужной вкладке
3. В DevTools → Elements
4. Найдите `<input type="file">`
5. Правый клик → Copy → Copy selector
6. Используйте скопированный селектор в команде

## ✅ Решение 2: VNC (полноценный GUI)

Если вам часто нужно загружать файлы, используйте **VNC** для полноценного удалённого рабочего стола:

```bash
# На сервере
ssh user@81.24.214.134
sudo apt install tigervnc-standalone-server xfce4
vncpasswd
vncserver :1 -geometry 1920x1080 -depth 24

# На локальной машине
ssh -L 5901:localhost:5901 user@81.24.214.134
# Затем подключитесь VNC клиентом к localhost:5901
```

**С VNC вы получаете:**
- ✅ Родные диалоги выбора файлов
- ✅ Адресную строку браузера
- ✅ Вкладки и расширения Chrome
- ✅ Полноценную работу как с локальным браузером

**Подробнее:** [VNC_SETUP.md](VNC_SETUP.md)

## ✅ Решение 3: API в коде

```typescript
import { SeleniumWd } from "./SeleniumWd";

const wd = SeleniumWd.init({
  debuggerHost: "81.24.214.134",
  debuggerPort: 9222,
});

await wd.connect();

// Загрузить файл
await wd.uploadFile('input#avatar', '/tmp/image.png');

// Несколько файлов
await wd.uploadMultipleFiles('input#photos', [
  '/tmp/photo1.jpg',
  '/tmp/photo2.jpg'
]);

// Автопоиск
await wd.findAndUploadFile('avatar', '/tmp/image.png', 'id');
```

## 🎯 Рекомендация

**Для разовой загрузки файлов:**
```bash
bun upload-file.ts 'input#file' '/tmp/file.pdf'
```

**Для частой работы с файлами:**
- Установите VNC (см. [VNC_SETUP.md](VNC_SETUP.md))
- Получите полноценный GUI с родными диалогами

**Для автоматизации:**
- Используйте API `wd.uploadFile()` в коде

## 📚 Дополнительная документация

- **[GUI_FOR_REMOTE.md](GUI_FOR_REMOTE.md)** - Подробно об ограничениях DevTools и решениях
- **[VNC_SETUP.md](VNC_SETUP.md)** - Полная инструкция по настройке VNC
- **[upload-file.ts](upload-file.ts)** - Исходный код скрипта загрузки
- **[README.md](README.md)** - Общая документация

---

**TL;DR:** Используйте `bun upload-file.ts 'селектор' 'путь-к-файлу'` для быстрой загрузки файлов! 🚀
