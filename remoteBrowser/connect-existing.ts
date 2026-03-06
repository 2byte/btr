/**
 * Подключение к уже запущенному браузеру с открытыми вкладками
 * Connecting to existing browser with open tabs
 */

import { SeleniumWd } from "./SeleniumWd";
import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killBrowser() {
  console.log("🔴 Закрытие всех процессов Chrome...\n");
  
  try {
    if (process.platform === "win32") {
      await execAsync("taskkill /F /IM chrome.exe /T");
      console.log("✅ Процессы Chrome закрыты\n");
    } else {
      await execAsync("pkill -9 chrome");
      console.log("✅ Процессы Chrome закрыты\n");
    }
    
    // Даем время на завершение процессов
    await new Promise(r => setTimeout(r, 1000));
  } catch (error: any) {
    if (error.message.includes("not found") || error.message.includes("не найден")) {
      console.log("⚠️  Процессы Chrome не найдены (возможно уже закрыты)\n");
    } else {
      console.error("❌ Ошибка при закрытии Chrome:", error.message);
    }
  }
}

async function restartVisibleBrowser(host: string = "localhost", port: number = 9222) {
  console.log("♻️  Перезапуск браузера с видимым окном...\n");
  
  await killBrowser();
  await startVisibleBrowser(host, port);
  
  console.log("✅ Браузер перезапущен с GUI!");
  console.log("   Теперь вы должны видеть окно браузера\n");
}

async function startVisibleBrowser(host: string = "localhost", port: number = 9222) {
  // ВНИМАНИЕ: Эта функция запускает Chrome ЛОКАЛЬНО на этой машине!
  // Для удалённого сервера используйте только 'connect' (без 'start')
  
  if (host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.")) {
    console.log("⚠️  ВНИМАНИЕ: Вы указали удалённый IP!");
    console.log("   Команда 'start' запускает браузер ЛОКАЛЬНО на этой машине.");
    console.log("   Для подключения к УДАЛЁННОМУ браузеру:");
    console.log("   1. Запустите Chrome на удалённом сервере");
    console.log("   2. Используйте только: bun connect-existing.ts (без start)\n");
    
    const answer = prompt("Продолжить запуск ЛОКАЛЬНОГО браузера? (y/N): ");
    if (answer?.toLowerCase() !== "y") {
      console.log("Отменено.\n");
      return;
    }
  }

  console.log(`🚀 Запуск ЛОКАЛЬНОГО браузера на порту ${port}...\n`);

  // Путь к Chrome
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  
  // Запускаем Chrome с GUI и remote debugging
  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    // Не используем headless - показываем GUI
  ], {
    detached: true,
    stdio: "ignore",
  });

  chromeProcess.unref();

  console.log("✅ ЛОКАЛЬНЫЙ браузер запущен с GUI");
  console.log("   Ожидание инициализации...\n");
  
  // Ждем пока браузер запустится
  await new Promise(r => setTimeout(r, 3000));
  
  return chromeProcess;
}

async function connectToExistingBrowser(host: string = "localhost", port: number = 9222, autoStart: boolean = false) {
  const isRemote = host !== "localhost" && host !== "127.0.0.1";
  
  if (isRemote) {
    console.log(`🌐 Подключение к УДАЛЁННОМУ браузеру ${host}:${port}...\n`);
  } else {
    console.log("🔌 Подключение к локальному браузеру...\n");
  }

  // Сначала проверяем доступность браузера
  try {
    const checkResponse = await fetch(`http://${host}:${port}/json/version`);
    if (!checkResponse.ok) {
      throw new Error("Browser not available");
    }
  } catch (error) {
    console.log(`❌ Браузер не отвечает на ${host}:${port}\n`);
    
    if (isRemote) {
      console.log("Для УДАЛЁННОГО браузера:");
      console.log(`  1. Подключитесь к серверу: ssh user@${host}`);
      console.log(`  2. Запустите Chrome на сервере:`);
      console.log(`     google-chrome --remote-debugging-port=${port} --remote-debugging-address=0.0.0.0`);
      console.log(`  3. Убедитесь что порт ${port} открыт в файрволле\n`);
      return;
    }
    
    if (autoStart) {
      console.log("   Запускаем локальный браузер с GUI...\n");
      await startVisibleBrowser(host, port);
    } else {
      console.log("Запустите локальный браузер:");
      console.log("   bun connect-existing.ts start");
      console.log("   или");
      console.log("   start-chrome-debug.bat\n");
      return;
    }
  }
  
  const wd = SeleniumWd.init({
    debuggerPort: port,
    debuggerHost: host,
  });

  try {
    // Подключаемся к уже запущенному браузеру
    await wd.connect();
    console.log("✅ Подключено к браузеру");
    
    // Проверяем подключение
    const isConnected = await wd.isConnected();
    if (!isConnected) {
      console.error("❌ Не удалось подключиться к браузеру");
      return;
    }

    // Получаем все существующие вкладки
    const tabs = await wd.getTabsInfo();
    
    // Предупреждение если браузер скрыт
    if (tabs.length > 0) {
      console.log("   ⚠️  Если не видите окно браузера - он запущен в скрытом режиме");
      console.log("   🔥 РЕШЕНИЕ: bun connect-existing.ts restart\n");
    } else {
      console.log();
    }

    console.log("📂 Получение информации о существующих вкладках...");
    
    console.log(`\n📊 Найдено ${tabs.length} открытых вкладок:\n`);
    tabs.forEach((tab, i) => {
      console.log(`${i + 1}. ${tab.title}`);
      console.log(`   URL: ${tab.url}`);
      console.log(`   Handle: ${tab.handle.substring(0, 20)}...`);
      console.log();
    });

    // Получаем cookies из всех вкладок
    console.log("🍪 Получение cookies из всех вкладок...");
    const cookiesMap = await wd.getAllCookiesFromAllTabs();
    
    let totalCookies = 0;
    for (const [handle, cookies] of cookiesMap) {
      const tab = tabs.find(t => t.handle === handle);
      console.log(`   ${tab?.title || 'Unknown'}: ${cookies.length} cookies`);
      totalCookies += cookies.length;
    }
    console.log(`   Всего cookies: ${totalCookies}\n`);

    // Переключаемся между вкладками
    if (tabs.length > 1) {
      console.log("🔄 Переключение между вкладками...");
      
      for (let i = 0; i < Math.min(tabs.length, 3); i++) {
        await wd.switchToWindow(tabs[i].handle);
        const currentUrl = await wd.getCurrentUrl();
        const currentTitle = await wd.getTitle();
        console.log(`   ${i + 1}. Переключились на: ${currentTitle}`);
        
        // Небольшая пауза для демонстрации
        await new Promise(r => setTimeout(r, 500));
      }
      console.log();
    }

    // Экспортируем текущую сессию
    console.log("💾 Экспорт текущей сессии...");
    const session = await wd.exportSession();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `existing-session-${timestamp}.json`;
    
    await Bun.write(filename, JSON.stringify(session, null, 2));
    console.log(`   ✅ Сессия сохранена в: ${filename}`);
    console.log(`   📊 Вкладок: ${session.tabs.length}`);
    console.log(`   🍪 URLs с cookies: ${Object.keys(session.cookies).length}\n`);

    // Статистика по доменам
    const domains = new Set<string>();
    for (const tab of session.tabs) {
      try {
        const url = new URL(tab.url);
        domains.add(url.hostname);
      } catch (e) {
        // ignore invalid URLs
      }
    }
    
    console.log(`🌐 Уникальных доменов: ${domains.size}`);
    if (domains.size > 0) {
      console.log("   Домены:");
      Array.from(domains).slice(0, 10).forEach(domain => {
        console.log(`   - ${domain}`);
      });
      if (domains.size > 10) {
        console.log(`   ... и ещё ${domains.size - 10}`);
      }
    }

    console.log("\n✅ Готово! Браузер остаётся открытым.\n");

    // Подсказка про GUI для удалённого браузера
    if (isRemote) {
      console.log("🖥️  Хотите видеть GUI удалённого браузера?");
      console.log("   Используйте Chrome DevTools Inspector:\n");
      console.log("   1. Откройте: chrome://inspect/#devices");
      console.log(`   2. Configure → добавьте ${host}:${port}`);
      console.log("   3. Нажмите 'inspect' на любой вкладке\n");
      console.log("   Или автоматически: bun open-devtools.ts\n");
      console.log("   📖 Подробнее: GUI_FOR_REMOTE.md\n");
    }

    // НЕ закрываем драйвер - просто отключаемся
    // await wd.close(); // Это закроет браузер!
    
  } catch (error) {
    console.error("\n❌ Ошибка:", error);
    throw error;
  }
}

async function listBrowserInfo(host: string, port: number) {
  console.log(`📋 Быстрая проверка браузера на ${host}:${port}...\n`);

  try {
    // Проверяем доступность через HTTP
    const response = await fetch(`http://${host}:${port}/json/version`);
    
    if (!response.ok) {
      console.error(`❌ Браузер не отвечает на ${host}:${port}`);
      console.log("\nЗапустите Chrome с remote debugging:");
      console.log(`   chrome.exe --remote-debugging-port=${port}\n`);
      return;
    }

    const info = await response.json();
    console.log("✅ Браузер найден!");
    console.log(`   Browser: ${info.Browser}`);
    console.log(`   Protocol: ${info["Protocol-Version"]}`);
    console.log(`   User-Agent: ${info["User-Agent"]}`);
    console.log(`   WebSocket: ${info.webSocketDebuggerUrl}\n`);

    // Получаем список вкладок
    const tabsResponse = await fetch(`http://${host}:${port}/json/list`);
    const tabs = await tabsResponse.json();
    
    const pages = tabs.filter((t: any) => t.type === 'page');
    console.log(`📂 Открытых страниц: ${pages.length}\n`);
    
    pages.slice(0, 5).forEach((page: any, i: number) => {
      console.log(`${i + 1}. ${page.title}`);
      console.log(`   ${page.url}`);
      console.log();
    });

    if (pages.length > 5) {
      console.log(`   ... и ещё ${pages.length - 5} вкладок\n`);
    }

  } catch (error) {
    console.error(`❌ Не удалось подключиться к браузеру на ${host}:${port}`);
    console.log("\nУбедитесь, что Chrome запущен с remote debugging:");
    console.log(`   chrome.exe --remote-debugging-port=${port}\n`);
  }
}

async function showHelp() {
  console.log(`
📖 Использование: bun connect-existing.ts [команда]

Команды:
  (нет)        - Подключиться к браузеру (host и port указаны в коде)
  start        - Запустить ЛОКАЛЬНЫЙ браузер с remote debugging
  restart      - Перезапустить ЛОКАЛЬНЫЙ браузер с видимым окном
  kill         - Закрыть все процессы Chrome
  auto         - Подключиться или запустить если не запущен
  gui          - 🖥️  Открыть Chrome DevTools для визуального управления (для удалённого)
  info         - Показать информацию о браузере без подключения
  check        - Проверить доступность браузера (alias для info)
  help         - Показать эту справку

⚠️  ВАЖНО: ЛОКАЛЬНЫЙ vs УДАЛЁННЫЙ браузер

ЛОКАЛЬНЫЙ браузер (на этом компьютере):
  - Измените в коде: const host = "localhost";
  - Команды start/restart работают
  - IP на 2ip.ru будет ваш локальный IP

УДАЛЁННЫЙ браузер (на сервере):
  - Укажите в коде: const host = "81.24.214.134"; (ваш IP сервера)
  - НЕ используйте start/restart (они запускают локально!)
  - Сначала запустите Chrome на сервере:
    1. SSH на сервер: ssh user@81.24.214.134
    2. Запустите: google-chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0
    3. Откройте порт в файрволле
  - Затем используйте: bun connect-existing.ts (без start!)
  - IP на 2ip.ru будет IP сервера

🖥️  GUI для удалённого браузера:
  - Команда: bun connect-existing.ts gui
  - Или: bun open-devtools.ts
  - Откроет chrome://inspect для визуального управления удалённым браузером
  - Вы увидите страницы и сможете кликать, отлаживать как локально!

Примеры:
  bun connect-existing.ts           # Подключиться к существующему браузеру
  bun connect-existing.ts gui       # 🖥️  Открыть GUI для удалённого браузера
  bun connect-existing.ts start     # Запустить ЛОКАЛЬНЫЙ браузер
  bun connect-existing.ts info      # Проверить доступность
  `);
}

// CLI
if (import.meta.main) {
  const command = Bun.argv[2];

  const host = "81.24.214.134";
  const port = 9222;

  switch (command) {
    case "start":
      await startVisibleBrowser(host, port);
      console.log("\n✅ Браузер запущен!");
      console.log("Теперь подключитесь: bun connect-existing.ts\n");
      break;

    case "restart":
      // Сначала сохраняем сессию если браузер запущен
      try {
        const checkResponse = await fetch(`http://${host}:${port}/json/version`);
        if (checkResponse.ok) {
          console.log("💾 Сохранение текущей сессии...\n");
          const wd = SeleniumWd.init({ debuggerPort: port, debuggerHost: host });
          await wd.connect();
          const session = await wd.exportSession();
          await Bun.write("temp-session-before-restart.json", JSON.stringify(session));
          console.log(`✅ Сессия сохранена (${session.tabs.length} вкладок)\n`);
        }
      } catch (e) {
        // Браузер не запущен, ничего не сохраняем
      }
      
      await restartVisibleBrowser(host, port);
      console.log("Подключитесь: bun connect-existing.ts\n");
      break;

    case "kill":
      await killBrowser();
      break;

    case "auto":
      await connectToExistingBrowser(host, port, true);
      break;

    case "gui":
    case "devtools":
      // Открываем DevTools для визуального управления
      console.log("🖥️  Открытие Chrome DevTools...\n");
      await Bun.spawn(["bun", "open-devtools.ts", host, port.toString()], {
        cwd: import.meta.dir,
        stdout: "inherit",
        stderr: "inherit",
      }).exited;
      break;

    case "info":
    case "check":
      await listBrowserInfo(host, port);
      break;

    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;

    default:
      await connectToExistingBrowser(host, port, false);
      break;
  }
}
