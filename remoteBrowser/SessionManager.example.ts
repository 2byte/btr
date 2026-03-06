/**
 * Session Manager Example
 * Demonstrates how to save and restore browser sessions with tabs and cookies
 */

import { SeleniumWd, TabInfo, SeleniumCookie } from "./SeleniumWd";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const SESSION_FILE = join(__dirname, "saved-session.json");

/**
 * Example 1: Save current browser session to file
 */
async function saveSessionToFile() {
  console.log("=== Saving Browser Session ===");
  
  // Connect to existing Chrome instance
  const wd = SeleniumWd.init({
    debuggerPort: 9222,
  });

  await wd.connect();
  
  // Export session data
  const sessionData = await wd.exportSession();
  
  // Save to file
  writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), "utf-8");
  
  console.log(`Session saved to ${SESSION_FILE}`);
  console.log(`- Tabs saved: ${sessionData.tabs.length}`);
  console.log(`- URLs with cookies: ${Object.keys(sessionData.cookies).length}`);
  
  sessionData.tabs.forEach((tab, i) => {
    const cookieCount = sessionData.cookies[tab.url]?.length || 0;
    console.log(`  Tab ${i + 1}: ${tab.title} (${cookieCount} cookies)`);
  });

  await wd.close();
}

/**
 * Example 2: Restore session from file to a new browser instance
 */
async function restoreSessionFromFile() {
  console.log("\n=== Restoring Browser Session ===");
  
  if (!existsSync(SESSION_FILE)) {
    console.error(`Session file not found: ${SESSION_FILE}`);
    console.log("Run saveSessionToFile() first!");
    return;
  }

  // Read session data
  const sessionData = JSON.parse(readFileSync(SESSION_FILE, "utf-8"));
  
  console.log(`Loading session with ${sessionData.tabs.length} tabs...`);

  // Launch new browser instance
  const wd = SeleniumWd.init({
    debuggerPort: 9223, // Different port to avoid conflicts
    headless: false,
  });

  await wd.launch();
  
  // Restore session
  await wd.importSession(sessionData);
  
  console.log("Session restored successfully!");
  
  // Verify
  const restoredTabs = await wd.getTabsInfo();
  console.log(`\nRestored ${restoredTabs.length} tabs:`);
  restoredTabs.forEach((tab, i) => {
    console.log(`  Tab ${i + 1}: ${tab.title}`);
  });

  console.log("\nBrowser is ready with restored session!");
}

/**
 * Example 3: Copy session from one browser to another
 */
async function cloneSession() {
  console.log("\n=== Cloning Session Between Browsers ===");

  // Connect to source browser
  const source = SeleniumWd.init({ debuggerPort: 9222 });
  await source.connect();
  
  console.log("Connected to source browser on port 9222");

  // Get session from source
  const sessionData = await source.exportSession();
  console.log(`Captured ${sessionData.tabs.length} tabs from source`);

  // Launch target browser
  const target = SeleniumWd.init({
    debuggerPort: 9224,
    headless: false,
  });
  await target.launch();
  
  console.log("Launched target browser on port 9224");

  // Restore session to target
  await target.importSession(sessionData);
  
  console.log("Session cloned successfully!");

  await source.close();
  
  console.log("Source browser disconnected, target is active");
}

/**
 * Example 4: Work with individual tabs and cookies
 */
async function manageTabsAndCookies() {
  console.log("\n=== Managing Tabs and Cookies ===");

  const wd = SeleniumWd.init({ debuggerPort: 9222 });
  await wd.connect();

  // Get all tabs
  const tabs = await wd.getTabsInfo();
  console.log(`\nFound ${tabs.length} open tabs:`);
  tabs.forEach((tab, i) => {
    console.log(`  ${i + 1}. ${tab.title} - ${tab.url}`);
  });

  // Get cookies from all tabs
  const cookiesMap = await wd.getAllCookiesFromAllTabs();
  console.log(`\nCookies per tab:`);
  
  for (const [handle, cookies] of cookiesMap) {
    const tab = tabs.find(t => t.handle === handle);
    console.log(`  Tab "${tab?.title}": ${cookies.length} cookies`);
  }

  // Switch to first tab and add custom cookie
  if (tabs.length > 0) {
    await wd.switchToWindow(tabs[0].handle);
    
    try {
      await wd.addCookie({
        name: "test_cookie",
        value: "test_value",
        path: "/",
        secure: false,
      });
      console.log("\nAdded custom cookie to first tab");
    } catch (e) {
      console.log("\nCould not add cookie:", (e as Error).message);
    }
  }

  await wd.close();
}

/**
 * Example 5: Scheduled session backup
 */
async function autoBackupSession(intervalMinutes: number = 5) {
  console.log(`\n=== Auto Session Backup (every ${intervalMinutes} min) ===`);

  const backupSession = async () => {
    try {
      const wd = SeleniumWd.init({ debuggerPort: 9222 });
      await wd.connect();

      const sessionData = await wd.exportSession();
      
      // Save with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = join(__dirname, `session-backup-${timestamp}.json`);
      
      writeFileSync(backupFile, JSON.stringify(sessionData, null, 2), "utf-8");
      
      console.log(`[${new Date().toLocaleString()}] Backup saved: ${backupFile}`);
      console.log(`  Tabs: ${sessionData.tabs.length}`);

      await wd.close();
    } catch (error) {
      console.error(`[${new Date().toLocaleString()}] Backup failed:`, error);
    }
  };

  // Initial backup
  await backupSession();

  // Schedule periodic backups
  setInterval(backupSession, intervalMinutes * 60 * 1000);
  
  console.log("Auto-backup is running. Press Ctrl+C to stop.");
}

// Command line interface
if (import.meta.main) {
  const command = Bun.argv[2];

  switch (command) {
    case "save":
      await saveSessionToFile();
      break;
    
    case "restore":
      await restoreSessionFromFile();
      break;
    
    case "clone":
      await cloneSession();
      break;
    
    case "manage":
      await manageTabsAndCookies();
      break;
    
    case "backup":
      const interval = parseInt(Bun.argv[3]) || 5;
      await autoBackupSession(interval);
      break;
    
    default:
      console.log(`
Session Manager - Browser Session Backup & Restore

Usage: bun SessionManager.example.ts <command>

Commands:
  save      - Save current browser session to file
  restore   - Restore session from file to new browser
  clone     - Clone session from one browser to another
  manage    - View and manage tabs and cookies
  backup [minutes] - Auto-backup session every N minutes (default: 5)

Examples:
  bun SessionManager.example.ts save
  bun SessionManager.example.ts restore
  bun SessionManager.example.ts backup 10
      `);
  }
}
