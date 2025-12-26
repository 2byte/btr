// Storage for active tabs history
let tabHistory = [];
let currentTab = null;

// Local server configuration
const LOCAL_SERVER_URL = "http://localhost:8012"; // Change port if needed
const SEND_LOCAL_SERVER = true; // Set to false to disable sending data to server

// Use browser API for Firefox (or chrome for compatibility)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;


async function getTargetDomains() {
  try {
    const response = await getFromLocalServer('/target-domains');

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
  if (!SEND_LOCAL_SERVER) {
    console.log("Sending to local server is disabled.");
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
      console.log("Data to send:", data);
      options.body = JSON.stringify(data);
    }

    const url = `${LOCAL_SERVER_URL}${endpoint}`;
    console.log(`Sending ${method} request to ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response from server:", result);
    return result;
  } catch (error) {
    console.error("Error sending data to server:", error);
    throw error;
  }
}

/**
 * Function to get data from local server
 * @param {string} endpoint - Path to API endpoint
 * @returns {Promise<object>} - Data from server
 */
async function getFromLocalServer(endpoint) {
  return await sendToLocalServer(endpoint, null, "GET");
}

/**
 * Function to get all cookies from active tab
 * @param {string} url - Tab URL to get cookies from
 * @returns {Promise<Array>} - Array of cookies
 */
async function getCookiesFromTab(url) {
  try {
    if (!url) {
      console.warn("URL not specified for getting cookies");
      return [];
    }

    // Get all cookies for this URL
    const cookies = await browserAPI.cookies.getAll({ url: url });
    console.log(`Got ${cookies.length} cookies for ${url}`);
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
        requestDump.rawData = details.requestBody.raw.map(item => {
          if (item.bytes) {
            // Convert ArrayBuffer to string
            const decoder = new TextDecoder('utf-8');
            try {
              return decoder.decode(item.bytes);
            } catch (e) {
              return '[Binary data]';
            }
          }
          return item;
        });
      }
    }

    console.log('Request dump captured:', requestDump.method, requestDump.url);

    // Send to local server
    sendToLocalServer('/request-dump', requestDump).catch(err => {
      console.log('Failed to send request dump:', err.message);
    });

  } catch (error) {
    console.error('Error dumping request:', error);
  }
}

// Function to save tab data
async function saveTabActivity(tab) {
  const cookies = await getActiveTabCookies();

  const targetDomains = await getTargetDomains();
  
  if (!targetDomains.some(domain => tab.url.includes(domain))) {
    console.log("Tab URL not in target domains, skipping save");
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

  console.log("Active tab:", activity);

  // Send data to local server (optional)
  sendToLocalServer("/tab-activity", activity).catch((err) =>
    console.log("Server unavailable:", err.message)
  );

  sendToLocalServer("/capture-start", activity).catch((err) => {
    console.log("Server unavailable for video capture:", err.message);
  });
}

// Track tab activation
browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browserAPI.tabs.get(activeInfo.tabId);
    saveTabActivity(tab);
    
  } catch (error) {
    console.error("Error getting tab information:", error);
  }
});

// Track tab updates (when URL changes)
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is active tab and URL has changed
  if (changeInfo.status === "complete" && tab.active) {
    saveTabActivity(tab);
  }
});

// Track window focus changes
browserAPI.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browserAPI.windows.WINDOW_ID_NONE) {
    // stop video capture on blur
    sendToLocalServer("/capture-stop").catch((err) => {
      console.log("Server unavailable for stopping video capture:", err.message);
    });
    console.log("Browser lost focus");
    return;
  }

  try {
    const tabs = await browserAPI.tabs.query({ active: true, windowId: windowId });
    if (tabs[0]) {
      saveTabActivity(tabs[0]);
    }
  } catch (error) {
    console.error("Error on window focus change:", error);
  }
});

// Intercept and dump HTTP requests for target domains
browserAPI.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Filter requests to target domains only
    const url = new URL(details.url);
    if (targetDomains.some(domain => url.hostname.includes(domain))) {
      // Only dump main requests and XHR/fetch requests
      if (details.type === 'main_frame' || details.type === 'sub_frame' || 
          details.type === 'xmlhttprequest') {
        dumpRequest(details);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Intercept request headers
browserAPI.webRequest.onSendHeaders.addListener(
  (details) => {
    const url = new URL(details.url);
    if (targetDomains.some(domain => url.hostname.includes(domain))) {
      if (details.type === 'main_frame' || details.type === 'sub_frame' || 
          details.type === 'xmlhttprequest') {
        // Update request dump with headers
        const headersDump = {
          requestId: details.requestId,
          url: details.url,
          method: details.method,
          timestamp: new Date().toISOString(),
          headers: details.requestHeaders ? details.requestHeaders.reduce((acc, header) => {
            acc[header.name] = header.value;
            return acc;
          }, {}) : {},
        };
        
        sendToLocalServer('/request-headers', headersDump).catch(err => {
          console.log('Failed to send headers dump:', err.message);
        });
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// Initialization on startup
browserAPI.runtime.onInstalled.addListener(async () => {
  console.log("Browser Tracker installed");

  // Load history from storage
  const result = await browserAPI.storage.local.get(["tabHistory", "currentTab"]);
  tabHistory = result.tabHistory || [];
  currentTab = result.currentTab || null;
});

// Load current active tab on startup
browserAPI.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs[0]) {
    saveTabActivity(tabs[0]);
  }
});
