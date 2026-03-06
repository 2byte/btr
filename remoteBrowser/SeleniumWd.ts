import { Builder, WebDriver, Capabilities, logging } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

/**
 * Configuration options for SeleniumWd remote browser connection
 */
export interface SeleniumWdOptions {
  /** Remote debugging port (default: 9222) */
  debuggerPort?: number;
  /** Remote debugging host (default: localhost) */
  debuggerHost?: string;
  /** Path to Chrome executable */
  chromePath?: string;
  /** Additional Chrome arguments */
  extraArgs?: string[];
  /** User data directory */
  userDataDir?: string;
  /** Connection timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Run browser in headless mode (default: false - GUI shown) */
  headless?: boolean;
}

/**
 * Cookie interface compatible with Selenium WebDriver
 */
export interface SeleniumCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expiry?: number; // seconds since epoch
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Tab information structure
 */
export interface TabInfo {
  handle: string;
  url: string;
  title: string;
}

/**
 * SeleniumWd class for managing Selenium WebDriver connections to remote browsers.
 * Provides methods to connect to a Chrome browser via remote debugging protocol.
 */
export class SeleniumWd {
  private driver?: WebDriver;
  private opts: Required<SeleniumWdOptions>;

  /**
   * Creates a new SeleniumWd instance
   * @param options - Configuration options for the remote browser connection
   */
  constructor(options: SeleniumWdOptions = {}) {
    this.opts = {
      debuggerPort: options.debuggerPort || 9222,
      debuggerHost: options.debuggerHost || "localhost",
      chromePath:
        options.chromePath || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      extraArgs: options.extraArgs || [],
      userDataDir: options.userDataDir || "",
      timeoutMs: options.timeoutMs || 30000,
      headless: options.headless ?? false,
    };
  }

  /**
   * Static factory method to create a SeleniumWd instance
   * @param options - Configuration options
   * @returns New SeleniumWd instance
   */
  static init(options?: SeleniumWdOptions): SeleniumWd {
    return new SeleniumWd(options);
  }

  /**
   * Launches a new Chrome browser instance with GUI or headless mode
   * @returns Promise that resolves when browser is launched and connected
   * @throws Error if launch fails
   */
  async launch(): Promise<void> {
    try {
      // Configure Chrome options
      const chromeOptions = new chrome.Options();
      
      // Set Chrome binary location
      chromeOptions.setChromeBinaryPath(this.opts.chromePath);

      // Configure headless mode
      if (this.opts.headless) {
        chromeOptions.addArguments('--headless=new');
      }

      // Add remote debugging port
      chromeOptions.addArguments(`--remote-debugging-port=${this.opts.debuggerPort}`);

      // Set user data dir if provided
      if (this.opts.userDataDir) {
        chromeOptions.addArguments(`--user-data-dir=${this.opts.userDataDir}`);
      }

      // Add extra arguments
      if (this.opts.extraArgs.length > 0) {
        chromeOptions.addArguments(...this.opts.extraArgs);
      }

      // Common Chrome arguments for stability
      chromeOptions.addArguments(
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      );

      // Enable performance logging
      const prefs = new logging.Preferences();
      prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.ALL);
      prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

      // Build and launch the WebDriver instance
      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .setLoggingPrefs(prefs)
        .build();

      // Set implicit wait timeout
      await this.driver.manage().setTimeouts({ implicit: this.opts.timeoutMs });

    } catch (error) {
      throw new Error(
        `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Connects to a remote Chrome browser using the debugger address
   * This will connect to an already running browser and access existing tabs
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails
   */
  async connect(): Promise<void> {
    try {
      const debuggerAddress = `${this.opts.debuggerHost}:${this.opts.debuggerPort}`;

      // Configure Chrome options for remote debugging
      const chromeOptions = new chrome.Options();
      
      // Set debugger address to connect to existing browser
      chromeOptions.debuggerAddress(debuggerAddress);

      // Important: Don't set user-data-dir when connecting to existing browser
      // It's already set in the running browser instance

      // Add extra arguments if provided (usually not needed for remote connection)
      if (this.opts.extraArgs.length > 0) {
        chromeOptions.addArguments(...this.opts.extraArgs);
      }

      // Enable performance logging
      const prefs = new logging.Preferences();
      prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.ALL);
      prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);

      // Build the WebDriver instance
      this.driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(chromeOptions)
        .setLoggingPrefs(prefs)
        .build();

      // Set implicit wait timeout
      await this.driver.manage().setTimeouts({ implicit: this.opts.timeoutMs });

      // Get all existing window handles (tabs)
      const handles = await this.driver.getAllWindowHandles();
      console.log(`Connected to browser with ${handles.length} existing tab(s)`);
      
      // Switch to the first existing tab if available
      if (handles.length > 0) {
        await this.driver.switchTo().window(handles[0]);
      }
    } catch (error) {
      throw new Error(
        `Failed to connect to remote browser: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Returns the WebDriver instance
   * @returns WebDriver instance or undefined if not connected
   */
  getDriver(): WebDriver | undefined {
    return this.driver;
  }

  /**
   * Checks if the driver is connected and active
   * @returns Promise that resolves to true if connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    if (!this.driver) {
      return false;
    }

    try {
      // Try to get current URL to verify connection
      await this.driver.getCurrentUrl();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Navigates to a specified URL
   * @param url - The URL to navigate to
   * @returns Promise that resolves when navigation completes
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    await this.driver.get(url);
  }

  /**
   * Executes JavaScript in the browser context
   * @param script - JavaScript code to execute
   * @param args - Arguments to pass to the script
   * @returns Promise that resolves to the script result
   */
  async executeScript<T = any>(script: string | Function, ...args: any[]): Promise<T> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.executeScript<T>(script, ...args);
  }

  /**
   * Gets all window handles (tabs)
   * @returns Promise that resolves to an array of window handle IDs
   */
  async getAllWindows(): Promise<string[]> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.getAllWindowHandles();
  }

  /**
   * Switches to a specific window/tab
   * @param handle - Window handle ID to switch to
   * @returns Promise that resolves when switch is complete
   */
  async switchToWindow(handle: string): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    await this.driver.switchTo().window(handle);
  }

  /**
   * Closes the WebDriver session and disconnects from the browser
   * @returns Promise that resolves when cleanup is complete
   */
  async close(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.quit();
      } catch (error) {
        // Ignore errors during cleanup
      } finally {
        this.driver = undefined;
      }
    }
  }

  /**
   * Takes a screenshot of the current page
   * @returns Promise that resolves to base64-encoded screenshot data
   */
  async takeScreenshot(): Promise<string> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.takeScreenshot();
  }

  /**
   * Gets the current page URL
   * @returns Promise that resolves to the current URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.getCurrentUrl();
  }

  /**
   * Gets the current page title
   * @returns Promise that resolves to the page title
   */
  async getTitle(): Promise<string> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.getTitle();
  }

  /**
   * Launches a new Chrome browser and connects to it
   * Convenience method that combines launch() and initial setup
   * @param startUrl - Optional URL to navigate to after launch
   * @returns Promise that resolves when browser is ready
   */
  async launchAndConnect(startUrl?: string): Promise<void> {
    await this.launch();
    if (startUrl) {
      await this.navigateTo(startUrl);
    }
  }

  /**
   * Gets all cookies from the current domain
   * @returns Promise that resolves to an array of cookies
   */
  async getCookies(): Promise<SeleniumCookie[]> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    return this.driver.manage().getCookies() as Promise<SeleniumCookie[]>;
  }

  /**
   * Gets all cookies from all open tabs
   * @returns Promise that resolves to a map of tab handles to their cookies
   */
  async getAllCookiesFromAllTabs(): Promise<Map<string, SeleniumCookie[]>> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    const cookiesMap = new Map<string, SeleniumCookie[]>();
    const handles = await this.getAllWindows();
    const currentHandle = await this.driver.getWindowHandle();

    for (const handle of handles) {
      try {
        await this.switchToWindow(handle);
        const cookies = await this.getCookies();
        cookiesMap.set(handle, cookies);
      } catch (error) {
        console.warn(`Failed to get cookies for tab ${handle}:`, error);
      }
    }

    // Switch back to original tab
    await this.switchToWindow(currentHandle);
    return cookiesMap;
  }

  /**
   * Sets a single cookie in the current domain
   * Note: You must navigate to the domain before setting cookies
   * @param cookie - Cookie object to set
   */
  async addCookie(cookie: SeleniumCookie): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    await this.driver.manage().addCookie(cookie);
  }

  /**
   * Sets multiple cookies in the current domain
   * @param cookies - Array of cookies to set
   */
  async setCookies(cookies: SeleniumCookie[]): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    for (const cookie of cookies) {
      try {
        await this.addCookie(cookie);
      } catch (error) {
        console.warn(`Failed to set cookie ${cookie.name}:`, error);
      }
    }
  }

  /**
   * Deletes all cookies in the current domain
   */
  async deleteAllCookies(): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }
    await this.driver.manage().deleteAllCookies();
  }

  /**
   * Gets information about all open tabs
   * @returns Promise that resolves to an array of tab information
   */
  async getTabsInfo(): Promise<TabInfo[]> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    const handles = await this.getAllWindows();
    const currentHandle = await this.driver.getWindowHandle();
    const tabsInfo: TabInfo[] = [];

    for (const handle of handles) {
      try {
        await this.switchToWindow(handle);
        const url = await this.getCurrentUrl();
        const title = await this.getTitle();
        tabsInfo.push({ handle, url, title });
      } catch (error) {
        console.warn(`Failed to get info for tab ${handle}:`, error);
        tabsInfo.push({ handle, url: "", title: "" });
      }
    }

    // Switch back to original tab
    await this.switchToWindow(currentHandle);
    return tabsInfo;
  }

  /**
   * Saves current browser session (tabs and cookies)
   * @returns Promise that resolves to session data
   */
  async saveSession(): Promise<{
    tabs: TabInfo[];
    cookiesByTab: Map<string, SeleniumCookie[]>;
  }> {
    const tabs = await this.getTabsInfo();
    const cookiesByTab = await this.getAllCookiesFromAllTabs();
    
    return {
      tabs,
      cookiesByTab,
    };
  }

  /**
   * Restores browser session by opening tabs and setting cookies
   * @param tabs - Array of tab information to restore
   * @param cookiesByUrl - Map of URLs to their cookies (optional)
   */
  async restoreSession(
    tabs: TabInfo[],
    cookiesByUrl?: Map<string, SeleniumCookie[]>
  ): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    // Close all existing tabs except the first one
    const existingHandles = await this.getAllWindows();
    if (existingHandles.length > 0) {
      await this.switchToWindow(existingHandles[0]);
    }

    // Open and restore each tab
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      
      try {
        // Create new tab or use existing first tab
        if (i > 0) {
          await this.driver.switchTo().newWindow('tab');
        }

        // Navigate to the URL
        if (tab.url && tab.url !== 'about:blank' && tab.url !== '') {
          // First navigate to the domain to be able to set cookies
          const url = new URL(tab.url);
          const domain = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}`;
          
          // Navigate to domain root first
          await this.navigateTo(domain);

          // Set cookies if available
          if (cookiesByUrl) {
            const cookies = cookiesByUrl.get(tab.url) || 
                           cookiesByUrl.get(tab.handle) ||
                           [];
            
            if (cookies.length > 0) {
              await this.setCookies(cookies);
            }
          }

          // Now navigate to the actual URL with cookies set
          await this.navigateTo(tab.url);
        }
      } catch (error) {
        console.warn(`Failed to restore tab ${tab.handle} (${tab.url}):`, error);
      }
    }
  }

  /**
   * Exports session to a JSON-serializable format
   * @returns Promise that resolves to serializable session data
   */
  async exportSession(): Promise<{
    tabs: TabInfo[];
    cookies: { [url: string]: SeleniumCookie[] };
  }> {
    const session = await this.saveSession();
    
    // Convert Map to plain object for JSON serialization
    const cookies: { [url: string]: SeleniumCookie[] } = {};
    const tabs = session.tabs;
    
    for (const [handle, tabCookies] of session.cookiesByTab) {
      const tab = tabs.find(t => t.handle === handle);
      if (tab && tab.url) {
        cookies[tab.url] = tabCookies;
      }
    }

    return {
      tabs,
      cookies,
    };
  }

  /**
   * Imports and restores session from exported JSON data
   * @param sessionData - Session data from exportSession()
   */
  async importSession(sessionData: {
    tabs: TabInfo[];
    cookies: { [url: string]: SeleniumCookie[] };
  }): Promise<void> {
    const cookiesMap = new Map<string, SeleniumCookie[]>(
      Object.entries(sessionData.cookies)
    );
    await this.restoreSession(sessionData.tabs, cookiesMap);
  }

  /**
   * Uploads a file to an input element by CSS selector
   * 
   * This method works even when connected to remote browser via CDP,
   * bypassing the file dialog limitation of Chrome DevTools Inspector.
   * 
   * @param selector - CSS selector for the input[type="file"] element
   * @param filePath - Absolute path to the file on the MACHINE WHERE CHROME IS RUNNING
   *                   For remote browser: path on remote server
   *                   For local browser: path on local machine
   * @returns Promise that resolves when file is uploaded
   * @throws Error if element not found or upload fails
   * 
   * @example
   * // For local browser
   * await wd.uploadFile('input[type="file"]', 'C:\\Users\\user\\image.png');
   * 
   * @example
   * // For remote browser (file must exist on remote server)
   * await wd.uploadFile('input#avatar', '/home/user/image.png');
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    try {
      // Find the file input element
      const fileInput = await this.driver.findElement({ css: selector });
      
      // Check if element is an input
      const tagName = await fileInput.getTagName();
      if (tagName.toLowerCase() !== 'input') {
        throw new Error(`Element ${selector} is not an input element (found: ${tagName})`);
      }

      // Send the file path to the input element
      // This bypasses the file dialog and works with remote browsers
      await fileInput.sendKeys(filePath);
      
      console.log(`✅ File uploaded: ${filePath} to ${selector}`);
    } catch (error) {
      throw new Error(`Failed to upload file to ${selector}: ${error}`);
    }
  }

  /**
   * Uploads multiple files to an input element by CSS selector
   * 
   * For input elements with 'multiple' attribute that accept multiple files.
   * 
   * @param selector - CSS selector for the input[type="file"][multiple] element
   * @param filePaths - Array of absolute file paths on the machine where Chrome is running
   * @returns Promise that resolves when all files are uploaded
   * @throws Error if element not found or upload fails
   * 
   * @example
   * await wd.uploadMultipleFiles('input#images', [
   *   'C:\\Users\\user\\image1.png',
   *   'C:\\Users\\user\\image2.jpg'
   * ]);
   */
  async uploadMultipleFiles(selector: string, filePaths: string[]): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    try {
      const fileInput = await this.driver.findElement({ css: selector });
      
      // Join file paths with newline for multiple file upload
      const filesString = filePaths.join('\n');
      await fileInput.sendKeys(filesString);
      
      console.log(`✅ ${filePaths.length} files uploaded to ${selector}`);
    } catch (error) {
      throw new Error(`Failed to upload multiple files to ${selector}: ${error}`);
    }
  }

  /**
   * Finds a file input element by various strategies and uploads a file
   * 
   * Useful when you don't know the exact selector. Tries multiple strategies:
   * - By ID
   * - By name attribute
   * - By class
   * - By xpath
   * 
   * @param identifier - ID, name, class, or xpath of the file input
   * @param filePath - Absolute path to the file
   * @param strategy - Search strategy: 'id', 'name', 'class', 'xpath', 'auto' (default: 'auto')
   * @returns Promise that resolves when file is uploaded
   * 
   * @example
   * await wd.findAndUploadFile('avatar', 'C:\\image.png', 'id');
   * await wd.findAndUploadFile('file-upload', 'C:\\doc.pdf', 'name');
   * await wd.findAndUploadFile('avatar', 'C:\\image.png'); // auto-detect
   */
  async findAndUploadFile(
    identifier: string,
    filePath: string,
    strategy: 'id' | 'name' | 'class' | 'xpath' | 'auto' = 'auto'
  ): Promise<void> {
    if (!this.driver) {
      throw new Error("Driver is not initialized. Call connect() first.");
    }

    const strategies = strategy === 'auto' 
      ? ['id', 'name', 'class'] 
      : [strategy];

    let lastError: Error | null = null;

    for (const strat of strategies) {
      try {
        let selector = '';
        switch (strat) {
          case 'id':
            selector = `input#${identifier}[type="file"]`;
            break;
          case 'name':
            selector = `input[name="${identifier}"][type="file"]`;
            break;
          case 'class':
            selector = `input.${identifier}[type="file"]`;
            break;
          case 'xpath':
            selector = identifier; // Use as-is for xpath
            break;
        }

        await this.uploadFile(selector, filePath);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        continue; // Try next strategy
      }
    }

    throw new Error(
      `Failed to find and upload file with identifier "${identifier}" using strategies: ${strategies.join(', ')}. Last error: ${lastError?.message}`
    );
  }
}

if (import.meta.main) {
  // Example 1: Launch new browser with GUI and save session
  console.log("=== Example 1: Launch browser, open tabs, and save session ===");
  const wd = SeleniumWd.init({
    debuggerPort: 9222,
    debuggerHost: "localhost",
    headless: false, // Show GUI (default)
  });

  await wd.launch();
  await wd.navigateTo("https://google.com");
  
  // Open additional tabs
  const driver = wd.getDriver()!;
  await driver.switchTo().newWindow('tab');
  await wd.navigateTo("https://github.com");
  
  await driver.switchTo().newWindow('tab');
  await wd.navigateTo("https://stackoverflow.com");

  // Get all tabs info
  console.log("\nGetting tabs info...");
  const tabs = await wd.getTabsInfo();
  tabs.forEach((tab, i) => {
    console.log(`Tab ${i + 1}: ${tab.title} - ${tab.url}`);
  });

  // Save complete session (tabs + cookies)
  console.log("\nSaving session...");
  const sessionData = await wd.exportSession();
  console.log(`Saved ${sessionData.tabs.length} tabs`);
  console.log(`Saved cookies for ${Object.keys(sessionData.cookies).length} URLs`);

  // Keep browser open for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close browser
  await wd.close();

  // Example 2: Connect to existing browser and restore session
  console.log("\n=== Example 2: Launch new browser and restore session ===");
  const wd2 = SeleniumWd.init({
    debuggerPort: 9223, // Different port
    headless: false,
  });

  await wd2.launch();
  
  // Restore the saved session
  console.log("\nRestoring session...");
  await wd2.importSession(sessionData);
  console.log("Session restored!");

  // Verify restored tabs
  const restoredTabs = await wd2.getTabsInfo();
  console.log("\nRestored tabs:");
  restoredTabs.forEach((tab, i) => {
    console.log(`Tab ${i + 1}: ${tab.title} - ${tab.url}`);
  });

  // Keep browser open
  console.log("\nBrowser will stay open. Close manually or call wd2.close()");
  
  // Example 3: Connect to existing remote browser with open tabs
  // IMPORTANT: Start Chrome first with: chrome.exe --remote-debugging-port=9224
  // Then open some tabs manually in that browser
  // Finally uncomment and run this example:
  
  // console.log("\n=== Example 3: Connect to existing browser ===");
  // const wd3 = SeleniumWd.init({ debuggerPort: 9224 });
  // await wd3.connect();
  // 
  // // Get all existing tabs from the browser
  // const existingTabs = await wd3.getTabsInfo();
  // console.log(`\nFound ${existingTabs.length} existing tabs:`);
  // existingTabs.forEach((tab, i) => {
  //   console.log(`${i + 1}. ${tab.title} - ${tab.url}`);
  // });
  // 
  // // Get cookies from all tabs
  // const existingCookies = await wd3.getAllCookiesFromAllTabs();
  // let totalCookies = 0;
  // for (const [_, cookies] of existingCookies) {
  //   totalCookies += cookies.length;
  // }
  // console.log(`\nTotal cookies: ${totalCookies}`);
  //
  // // Save existing session
  // const existingSession = await wd3.exportSession();
  // await Bun.write("existing-session.json", JSON.stringify(existingSession));
  // console.log("\nExisting session saved to existing-session.json");
}
