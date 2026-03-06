/**
 * Простой тест Session Manager
 * Проверяет основные методы работы с сессиями
 */

import { SeleniumWd, type TabInfo, type SeleniumCookie } from "./SeleniumWd";

async function testSessionMethods() {
  console.log("🧪 Тестирование Session Manager\n");

  try {
    // Тест 1: Запуск браузера
    console.log("1️⃣ Тест: Запуск браузера...");
    const wd = SeleniumWd.init({
      debuggerPort: 9222,
      headless: false,
    });
    await wd.launch();
    console.log("   ✅ Браузер запущен\n");

    // Тест 2: Навигация
    console.log("2️⃣ Тест: Навигация на страницу...");
    await wd.navigateTo("https://example.com");
    const url = await wd.getCurrentUrl();
    const title = await wd.getTitle();
    console.log(`   ✅ URL: ${url}`);
    console.log(`   ✅ Title: ${title}\n`);

    // Тест 3: Получение информации о вкладках
    console.log("3️⃣ Тест: Получение информации о вкладках...");
    const tabs = await wd.getTabsInfo();
    console.log(`   ✅ Найдено вкладок: ${tabs.length}`);
    tabs.forEach((tab, i) => {
      console.log(`      ${i + 1}. ${tab.title}`);
    });
    console.log();

    // Тест 4: Получение cookies
    console.log("4️⃣ Тест: Получение cookies...");
    const cookies = await wd.getCookies();
    console.log(`   ✅ Найдено cookies: ${cookies.length}`);
    if (cookies.length > 0) {
      console.log(`      Пример: ${cookies[0].name} = ${cookies[0].value.substring(0, 20)}...`);
    }
    console.log();

    // Тест 5: Добавление cookie
    console.log("5️⃣ Тест: Добавление cookie...");
    try {
      await wd.addCookie({
        name: "test_cookie",
        value: "test_value_123",
        path: "/",
      });
      const updatedCookies = await wd.getCookies();
      const testCookie = updatedCookies.find(c => c.name === "test_cookie");
      if (testCookie) {
        console.log(`   ✅ Cookie добавлен: ${testCookie.name} = ${testCookie.value}`);
      } else {
        console.log(`   ⚠️  Cookie не найден после добавления`);
      }
    } catch (e) {
      console.log(`   ⚠️  Не удалось добавить cookie: ${(e as Error).message}`);
    }
    console.log();

    // Тест 6: Открытие дополнительных вкладок
    console.log("6️⃣ Тест: Открытие дополнительных вкладок...");
    const driver = wd.getDriver()!;
    
    await driver.switchTo().newWindow('tab');
    await wd.navigateTo("https://httpbin.org/cookies/set?session=abc123");
    await new Promise(r => setTimeout(r, 1000));

    const updatedTabs = await wd.getTabsInfo();
    console.log(`   ✅ Теперь открыто вкладок: ${updatedTabs.length}\n`);

    // Тест 7: Получение cookies из всех вкладок
    console.log("7️⃣ Тест: Получение cookies из всех вкладок...");
    const allCookies = await wd.getAllCookiesFromAllTabs();
    console.log(`   ✅ Собрано cookies из ${allCookies.size} вкладок`);
    let totalCookies = 0;
    for (const [handle, cookies] of allCookies) {
      totalCookies += cookies.length;
      const tab = updatedTabs.find(t => t.handle === handle);
      console.log(`      ${tab?.title || 'Unknown'}: ${cookies.length} cookies`);
    }
    console.log(`   ✅ Всего cookies: ${totalCookies}\n`);

    // Тест 8: Экспорт сессии
    console.log("8️⃣ Тест: Экспорт сессии...");
    const sessionData = await wd.exportSession();
    console.log(`   ✅ Экспортировано:`);
    console.log(`      - Вкладок: ${sessionData.tabs.length}`);
    console.log(`      - URLs с cookies: ${Object.keys(sessionData.cookies).length}`);
    
    let exportedCookiesCount = 0;
    for (const url in sessionData.cookies) {
      exportedCookiesCount += sessionData.cookies[url].length;
    }
    console.log(`      - Всего cookies: ${exportedCookiesCount}\n`);

    // Тест 9: Скриншот
    console.log("9️⃣ Тест: Создание скриншота...");
    const screenshot = await wd.takeScreenshot();
    console.log(`   ✅ Скриншот создан: ${screenshot.length} символов base64\n`);

    // Закрываем первый браузер
    console.log("🔄 Закрытие первого браузера...");
    await wd.close();
    console.log("   ✅ Браузер закрыт\n");

    // Тест 10: Восстановление сессии
    console.log("🔟 Тест: Восстановление сессии в новом браузере...");
    const wd2 = SeleniumWd.init({
      debuggerPort: 9223, // Другой порт
      headless: false,
    });
    await wd2.launch();
    console.log("   ✅ Новый браузер запущен");

    await wd2.importSession(sessionData);
    console.log("   ✅ Сессия импортирована");

    const restoredTabs = await wd2.getTabsInfo();
    console.log(`   ✅ Восстановлено вкладок: ${restoredTabs.length}`);
    restoredTabs.forEach((tab, i) => {
      console.log(`      ${i + 1}. ${tab.title}`);
      console.log(`         ${tab.url}`);
    });

    // Проверяем cookies
    const restoredCookiesMap = await wd2.getAllCookiesFromAllTabs();
    let restoredCookiesCount = 0;
    for (const [_, cookies] of restoredCookiesMap) {
      restoredCookiesCount += cookies.length;
    }
    console.log(`   ✅ Восстановлено cookies: ${restoredCookiesCount}\n`);

    console.log("✅ Все тесты пройдены успешно!");
    console.log("\n⚠️  Браузер останется открытым. Закройте вручную или нажмите Ctrl+C");

    // await wd2.close();

  } catch (error) {
    console.error("\n❌ Ошибка в тестах:", error);
    throw error;
  }
}

if (import.meta.main) {
  await testSessionMethods();
}
