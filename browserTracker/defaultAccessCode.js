globalThis.browserAPI = typeof browser !== "undefined" ? browser : chrome;

function createBlocker() {
  // Check if already exists
  if (document.getElementById("code-blocker-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "code-blocker-overlay";
  overlay.innerHTML = `
      <div class="code-modal">

        <div class="icon">🔒</div>
        <h2>Введіть код доступу</h2>
        <p>З метою безпеки, вам необхідно підтвердити вашу особу. Для продовження роботи з сайтом потрібен одноразовий код який відправлений на ваш пристрій.</p>
        <input type="text" id="access-code-input" placeholder="Введіть код" autocomplete="off">
        <button id="submit-code-btn">Підтвердити</button>
        <div id="error-message" style="color:#ff4444; margin-top:10px; display:none;"></div>
      </div>
    `;

  const style = document.createElement("style");
  style.setAttribute('data-code-blocker', 'true');
  style.textContent = `
      #code-blocker-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.62);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: 'Segoe UI', Arial, sans-serif;
        color: white;
      }
      .code-modal {
        background: #1e1e1e;
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
        text-align: center;
        max-width: 420px;
        width: 90%;
      }
      .code-modal .icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      .code-modal h2 {
        font-size: 28px;
        margin-bottom: 15px;
        color: #ffcc00;
      }
      .code-modal p {
        font-size: 18px;
        margin-bottom: 30px;
        opacity: 0.9;
      }
      #access-code-input {
        width: 100%;
        padding: 14px;
        font-size: 18px;
        border: none;
        border-radius: 8px;
        margin-bottom: 20px;
        box-sizing: border-box;
      }
      #submit-code-btn {
        background: #ffcc00;
        color: #000;
        border: none;
        padding: 14px 30px;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.3s;
      }
      #submit-code-btn:hover {
        background: #ffe680;
      }
      #submit-code-btn:disabled {
        background: #666;
        cursor: not-allowed;
      }
      body { overflow: hidden !important; }
    `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  document.body.style.overflow = "hidden";
  overlay.addEventListener("contextmenu", (e) => e.preventDefault());

  const input = document.getElementById("access-code-input");
  const btn = document.getElementById("submit-code-btn");
  const errorMsg = document.getElementById("error-message");

  const verifyCode = () => {
    const code = input.value.trim();
    if (!code) {
      errorMsg.textContent = "Будь ласка, введіть код";
      errorMsg.style.display = "block";
      return;
    }

    btn.disabled = true;
    errorMsg.style.display = "none";

    // Send message to content script via postMessage
    window.postMessage({
      type: 'PLUGIN_TO_EXTENSION',
      plugin: 'defaultCodeAccess',
      action: 'verifyCode',
      data: { 
        code: code,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: new Date().toISOString()
      }
    }, '*');
  };

  btn.addEventListener("click", verifyCode);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") verifyCode();
  });

  input.focus();

  return overlay;
}

function removeBlocker() {
  const overlay = document.getElementById("code-blocker-overlay");
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = "";
  }
  const style = document.querySelector("style[data-code-blocker]");
  if (style) style.remove();
}

// Listen for messages from content script
window.addEventListener('message', (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;
  
  if (event.data.type === 'EXTENSION_TO_PLUGIN' && event.data.plugin === 'defaultCodeAccess') {
    console.log('[DefaultCodeAccess] Received message:', event.data);
    const dataPlugin = event.data.data;

    if (dataPlugin.action === 'showBlocker') {
      console.log('[DefaultCodeAccess] Showing blocker');
      createBlocker();
    } else if (dataPlugin.action === 'removeBlocker') {
      console.log('[DefaultCodeAccess] Removing blocker');
      removeBlocker();
    } else if (dataPlugin.action === 'verifyCodeResponse') {
      console.log('[DefaultCodeAccess] Code verification response:', event.data);
      
      if (event.data.success) {
        removeBlocker();
        console.log('[DefaultCodeAccess] Access granted!');
      } else {
        const errorMsg = document.getElementById("error-message");
        const btn = document.getElementById("submit-code-btn");
        if (errorMsg && btn) {
          errorMsg.textContent = event.data.message || "Невірний код";
          errorMsg.style.display = "block";
          btn.disabled = false;
        }
      }
    }
  }
});

// Initial, check if blocker is needed
const statusUpdater = () => {
    window.postMessage({
    type: 'PLUGIN_TO_EXTENSION',
    plugin: 'defaultCodeAccess',
    action: 'checkAccess',
    data: { domain: location.hostname }
  }, '*');
};

setInterval(statusUpdater, 10 * 1000); // every 10 seconds

console.log('[DefaultCodeAccess] Plugin loaded and ready');
