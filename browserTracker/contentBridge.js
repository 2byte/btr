// Content script bridge between page and background

globalThis.browserAPI = typeof browser !== "undefined" ? browser : chrome;

console.log('[ContentBridge] Loaded');

// Listen for messages from injected scripts (page context)
window.addEventListener('message', (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;
  
  if (event.data.type === 'PLUGIN_TO_EXTENSION') {
    console.log('[ContentBridge] Message from plugin:', event.data);
    
    // Forward to background script
    browserAPI.runtime.sendMessage({
      type: 'plugin-message',
      plugin: event.data.plugin,
      action: event.data.action,
      data: event.data.data
    }, (response) => {
      console.log('[ContentBridge] Response from background:', response);
      
      // Send response back to page
      if (response) {
        window.postMessage({
          type: 'EXTENSION_TO_PLUGIN',
          plugin: event.data.plugin,
          action: response.action || event.data.action + 'Response',
          success: response.success,
          message: response.message,
          data: response.data
        }, '*');
      }
    });
  }
});

// Listen for messages from background script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ContentBridge] Message from background:', message);
  
  if (message.type === 'extension-to-plugin') {
    // Forward to page
    window.postMessage({
      type: 'EXTENSION_TO_PLUGIN',
      plugin: message.plugin,
      action: message.action,
      data: message.data
    }, '*');
    
    sendResponse({ success: true });
  }
  
  return true; // Keep channel open for async
});

console.log('[ContentBridge] Ready');