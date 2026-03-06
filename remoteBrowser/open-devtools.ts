/**
 * Открытие Chrome DevTools для удалённого браузера
 * Автоматически настраивает chrome://inspect для удалённого доступа
 */

import { spawn } from "child_process";
import os from "os";

async function openDevToolsForRemote(host: string, port: number) {
  console.log(`📡 Настройка Chrome DevTools для ${host}:${port}...\n`);

  // Получаем список вкладок с удалённого браузера
  try {
    const response = await fetch(`http://${host}:${port}/json`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const tabs = await response.json();
    const pages = tabs.filter((t: any) => t.type === 'page');

    console.log(`✅ Подключение успешно`);
    console.log(`📂 Найдено ${pages.length} страниц:\n`);

    pages.slice(0, 5).forEach((tab: any, i: number) => {
      console.log(`${i + 1}. ${tab.title}`);
      console.log(`   ${tab.url}`);
      console.log();
    });

    if (pages.length > 5) {
      console.log(`   ... и ещё ${pages.length - 5}\n`);
    }

    // Инструкции по открытию DevTools
    console.log(`\n🔧 Как открыть GUI для управления удалённым браузером:\n`);
    console.log(`1. Откройте новую вкладку Chrome на вашей локальной машине`);
    console.log(`2. Перейдите по адресу: chrome://inspect/#devices`);
    console.log(`3. Нажмите "Configure..." рядом с "Discover network targets"`);
    console.log(`4. Добавьте адрес: ${host}:${port}`);
    console.log(`5. Нажмите "Done" и подождите несколько секунд`);
    console.log(`6. Вы увидите список удалённых вкладок`);
    console.log(`7. Нажмите "inspect" на любой вкладке\n`);

    console.log(`✨ После этого откроется DevTools с полным доступом к странице!\n`);

    // Пытаемся открыть chrome://inspect автоматически
    console.log(`🚀 Открываем chrome://inspect...\n`);
    
    const platform = os.platform();
    let chromeCommand: string;

    if (platform === 'win32') {
      chromeCommand = 'start';
    } else if (platform === 'darwin') {
      chromeCommand = 'open';
    } else {
      chromeCommand = 'xdg-open';
    }

    const inspectUrl = 'chrome://inspect/#devices';

    try {
      if (platform === 'win32') {
        spawn('cmd', ['/c', 'start', 'chrome', inspectUrl], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else if (platform === 'darwin') {
        spawn('open', ['-a', 'Google Chrome', inspectUrl], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      } else {
        spawn('google-chrome', [inspectUrl], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      }

      console.log(`✅ Chrome DevTools откроется автоматически`);
      console.log(`   Если нет - откройте вручную: chrome://inspect\n`);
    } catch (e) {
      console.log(`⚠️  Не удалось открыть Chrome автоматически`);
      console.log(`   Откройте вручную: chrome://inspect\n`);
    }

    // Показываем что можно делать
    console.log(`\n📚 Что вы можете делать в DevTools:\n`);
    console.log(`✅ Видеть содержимое страницы в реальном времени`);
    console.log(`✅ Взаимодействовать с элементами`);
    console.log(`✅ Выполнять JavaScript в консоли`);
    console.log(`✅ Просматривать Network, Console, Sources`);
    console.log(`✅ Делать скриншоты (Cmd+Shift+P → "Capture screenshot")`);
    console.log(`✅ Эмулировать мобильные устройства`);
    console.log(`✅ Отлаживать код`);

    console.log(`\n💡 Совет: Держите это подключение открытым для программного управления\n`);

  } catch (error) {
    console.error(`\n❌ Не удалось подключиться к ${host}:${port}`);
    console.error(`\nПричины:`);
    console.error(`1. Браузер не запущен на сервере`);
    console.error(`2. Порт ${port} закрыт в файрволле`);
    console.error(`3. Неправильный IP адрес\n`);
    console.error(`Проверьте: curl http://${host}:${port}/json/version\n`);
    throw error;
  }
}

async function showQuickGuide() {
  console.log(`
🖥️  GUI для управления удалённым браузером

Есть 2 способа работы с удалённым браузером:

1. 📟 Программный (через этот скрипт)
   - Получение списка вкладок
   - Управление через Selenium
   - Сохранение сессий
   - Автоматизация

2. 🖱️  Интерактивный (через Chrome DevTools)
   - Визуальный просмотр страниц
   - Клики, навигация
   - Отладка JavaScript
   - Инспектирование элементов

Для GUI используйте: chrome://inspect/#devices

Команды:
  bun open-devtools.ts [host] [port]  - Открыть DevTools для удалённого браузера
  bun open-devtools.ts                - Использовать host/port по умолчанию

Примеры:
  bun open-devtools.ts 81.24.214.134 9222
  bun open-devtools.ts localhost 9222
  `);
}

// CLI
if (import.meta.main) {
  const args = Bun.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
    showQuickGuide();
  } else {
    // Default к текущему удалённому хосту
    const host = args[0] || "81.24.214.134";
    const port = args[1] ? parseInt(args[1]) : 9222;

    await openDevToolsForRemote(host, port);
  }
}
