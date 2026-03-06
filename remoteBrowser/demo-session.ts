/**
 * Быстрая демонстрация работы с сессиями браузера
 * Quick demo of browser session management
 */

import { SeleniumWd } from "./SeleniumWd";

async function demo() {
  console.log("🚀 Демонстрация Session Manager\n");

  // Шаг 1: Запускаем браузер и открываем несколько вкладок
  console.log("📂 Шаг 1: Запускаем браузер и открываем вкладки...");
  const wd = SeleniumWd.init({
    debuggerPort: 9222,
    headless: false, // Показываем GUI
  });

  await wd.launch();
  
  const driver = wd.getDriver()!;
  
  // Открываем несколько вкладок с популярными сайтами
  await wd.navigateTo("https://google.com");
  await new Promise(r => setTimeout(r, 1000));
  
  await driver.switchTo().newWindow('tab');
  await wd.navigateTo("https://github.com");
  await new Promise(r => setTimeout(r, 1000));
  
  await driver.switchTo().newWindow('tab');
  await wd.navigateTo("https://stackoverflow.com");
  await new Promise(r => setTimeout(r, 1000));

  // Шаг 2: Получаем информацию о вкладках
  console.log("\n📊 Шаг 2: Получаем информацию о вкладках...");
  const tabs = await wd.getTabsInfo();
  tabs.forEach((tab, i) => {
    console.log(`   ${i + 1}. ${tab.title}`);
    console.log(`      ${tab.url}`);
  });

  // Шаг 3: Получаем cookies
  console.log("\n🍪 Шаг 3: Получаем cookies из всех вкладок...");
  const cookiesMap = await wd.getAllCookiesFromAllTabs();
  let totalCookies = 0;
  for (const [handle, cookies] of cookiesMap) {
    const tab = tabs.find(t => t.handle === handle);
    console.log(`   ${tab?.title}: ${cookies.length} cookies`);
    totalCookies += cookies.length;
  }
  console.log(`   Всего cookies: ${totalCookies}`);

  // Шаг 4: Сохраняем сессию
  console.log("\n💾 Шаг 4: Сохраняем сессию...");
  const sessionData = await wd.exportSession();
  console.log(`   ✓ Сохранено ${sessionData.tabs.length} вкладок`);
  console.log(`   ✓ Сохранено cookies для ${Object.keys(sessionData.cookies).length} URL`);

  console.log("\n⏳ Закрываем браузер через 3 секунды...");
  await new Promise(r => setTimeout(r, 3000));
  await wd.close();

  // Шаг 5: Восстанавливаем сессию в новом браузере
  console.log("\n🔄 Шаг 5: Восстанавливаем сессию в новом браузере...");
  const wd2 = SeleniumWd.init({
    debuggerPort: 9223, // Другой порт
    headless: false,
  });

  await wd2.launch();
  
  console.log("   Импортируем сохранённую сессию...");
  await wd2.importSession(sessionData);

  // Проверяем восстановленные вкладки
  const restoredTabs = await wd2.getTabsInfo();
  console.log(`\n✅ Восстановлено ${restoredTabs.length} вкладок:`);
  restoredTabs.forEach((tab, i) => {
    console.log(`   ${i + 1}. ${tab.title}`);
  });

  console.log("\n🎉 Демонстрация завершена!");
  console.log("   Браузер останется открытым. Закройте вручную или нажмите Ctrl+C\n");

  // Не закрываем браузер, чтобы пользователь мог посмотреть результат
  // await wd2.close();
}

// Запуск демонстрации
if (import.meta.main) {
  try {
    await demo();
  } catch (error) {
    console.error("\n❌ Ошибка:", error);
    process.exit(1);
  }
}
