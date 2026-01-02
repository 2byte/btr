# Универсальная система плагинов

## Архитектура

### Поток данных:
```
Браузерный плагин (browPlugin.js)
    ↓ postMessage({ type: 'PLUGIN_TO_EXTENSION', plugin, action, data })
Content Script (contentBridge.js)
    ↓ chrome.runtime.sendMessage({ type: 'plugin-message', plugin, action, data })
Background Script (background.js)
    ↓ HTTP POST /plugin-action { plugin, action, data, sender }
Сервер (index.ts)
    ↓ ExtPlugin.getPluginInstance(plugin)
    ↓ pluginInstance.handleAction(context)
Плагин (DefaultCodeAccess.ts)
    ↓ Обработка action и возврат результата
    ↓ HTTP Response { success, message, data }
Background → Content → Page
```

## Создание нового плагина

### 1. Создайте класс плагина

```typescript
// serverVideoCapture/extPlugins/myPlugin/MyPlugin.ts
import { ExtPlugin, PluginActionContext, PluginActionResult } from "../ExtPlugin";
import { Server } from "../../Server";
import path from "path";

export class MyPlugin extends ExtPlugin {
    public sourceFilesForInjection = [
        path.join(__dirname, 'browMyPlugin.js'),
    ];
    
    constructor() {
        super();
        this.name = "myPlugin";
    }

    install(server: Server): void {
        super.install(server);
        
        // Регистрируйте свои HTTP эндпоинты здесь
        server.get('/my-plugin/status', async (req) => {
            return server.jsonResponse({ status: 'ok' });
        });
        
        console.log('[MyPlugin] Installed');
    }

    async handleAction(context: PluginActionContext): Promise<PluginActionResult> {
        console.log(`[MyPlugin] Action: ${context.action}`, context.data);

        switch (context.action) {
            case 'doSomething':
                return this.doSomething(context);
            
            case 'getData':
                return this.getData(context);
            
            default:
                return {
                    success: false,
                    message: `Unknown action: ${context.action}`
                };
        }
    }

    private async doSomething(context: PluginActionContext): Promise<PluginActionResult> {
        // Ваша логика
        return {
            success: true,
            message: 'Done!',
            data: { result: 'some data' }
        };
    }

    private async getData(context: PluginActionContext): Promise<PluginActionResult> {
        return {
            success: true,
            data: { items: [1, 2, 3] }
        };
    }
}
```

### 2. Зарегистрируйте плагин

```typescript
// serverVideoCapture/extPlugins/extPluginsConfig.ts
import { ExtPlugin } from "./ExtPlugin";
import { DefaultCodeAccess } from "./defaultCodeAccess/DefaultCodeAccess";
import { MyPlugin } from "./myPlugin/MyPlugin";

ExtPlugin.registerPlugin(DefaultCodeAccess);
ExtPlugin.registerPlugin(MyPlugin); // Добавьте свой плагин
```

### 3. Создайте браузерный скрипт

```javascript
// serverVideoCapture/extPlugins/myPlugin/browMyPlugin.js

function doSomething() {
    // Отправка action в расширение
    window.postMessage({
        type: 'PLUGIN_TO_EXTENSION',
        plugin: 'myPlugin',
        action: 'doSomething',
        data: { 
            value: 123,
            timestamp: Date.now()
        }
    }, '*');
}

function getData() {
    window.postMessage({
        type: 'PLUGIN_TO_EXTENSION',
        plugin: 'myPlugin',
        action: 'getData',
        data: {}
    }, '*');
}

// Слушаем ответы от расширения
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'EXTENSION_TO_PLUGIN' && event.data.plugin === 'myPlugin') {
        console.log('[MyPlugin] Response:', event.data);
        
        if (event.data.action === 'doSomethingResponse') {
            if (event.data.success) {
                console.log('Success!', event.data.data);
            } else {
                console.error('Error:', event.data.message);
            }
        }
        
        if (event.data.action === 'getDataResponse') {
            console.log('Got data:', event.data.data);
        }
    }
});

console.log('[MyPlugin] Browser script loaded');

// Автоматически вызвать действие при загрузке
doSomething();
```

## Преимущества

✅ **Не нужно обновлять расширение** - вся логика на сервере
✅ **Динамическая загрузка** - плагины загружаются с сервера
✅ **Универсальный обработчик** - один endpoint для всех плагинов
✅ **Изоляция** - каждый плагин независим
✅ **Легко добавлять новые** - просто создайте класс и зарегистрируйте

## API

### PluginActionContext
```typescript
{
    plugin: string;      // Имя плагина
    action: string;      // Действие
    data: any;          // Данные от браузера
    sender: {
        tabId: number | null;
        url: string | null;
        frameId: number;
    }
}
```

### PluginActionResult
```typescript
{
    success: boolean;    // Успешно или нет
    message?: string;    // Сообщение об ошибке/успехе
    data?: any;         // Любые дополнительные данные
    [key: string]: any; // Любые другие поля
}
```

## Примеры использования

### Отправка action из браузера
```javascript
window.postMessage({
    type: 'PLUGIN_TO_EXTENSION',
    plugin: 'myPlugin',
    action: 'myAction',
    data: { foo: 'bar' }
}, '*');
```

### Получение ответа
```javascript
window.addEventListener('message', (event) => {
    if (event.data.type === 'EXTENSION_TO_PLUGIN' && 
        event.data.plugin === 'myPlugin' &&
        event.data.action === 'myActionResponse') {
        
        console.log('Response:', event.data);
    }
});
```

### Отправка команды плагину из background.js
```javascript
browserAPI.tabs.sendMessage(tabId, {
    type: 'extension-to-plugin',
    plugin: 'myPlugin',
    action: 'showNotification',
    data: { message: 'Hello!' }
});
```
