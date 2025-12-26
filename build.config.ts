export interface BuildConfig {
  name: string;
  version: string;
  description: string;
  manifestVersion: 2 | 3;
  outputDir: string;
  includePopup: boolean;
  permissions: string[];
  browserSpecificSettings?: {
    gecko?: {
      id: string;
      strict_min_version: string;
    };
  };
}

export const configs: Record<string, BuildConfig> = {
  // Firefox development (manifest v2 with popup)
  "firefox-dev": {
    name: "Browser Tracker Dev",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 2,
    outputDir: "dist/firefox-dev",
    includePopup: true,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest",
      "webRequestBlocking",
      "http://localhost/*",
      "http://127.0.0.1/*",
      "http://*/*",
      "https://*/*"
    ],
    browserSpecificSettings: {
      gecko: {
        id: "support@car-disks.com",
        strict_min_version: "109.0"
      }
    }
  },

  // Firefox production (manifest v2 without popup)
  "firefox-prod": {
    name: "Browser Tracker",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 2,
    outputDir: "dist/firefox-prod",
    includePopup: false,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest",
      "webRequestBlocking",
      "http://localhost/*",
      "http://127.0.0.1/*",
      "http://*/*",
      "https://*/*"
    ],
    browserSpecificSettings: {
      gecko: {
        id: "support@car-disks.com",
        strict_min_version: "109.0"
      }
    }
  },

  // Chrome/Opera development (manifest v3 with popup)
  "chrome-dev": {
    name: "Browser Tracker Dev",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/chrome-dev",
    includePopup: true,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest"
    ],
    // В manifest v3 host_permissions отдельно
  },

  // Chrome/Opera production (manifest v3 without popup)
  "chrome-prod": {
    name: "Browser Tracker",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/chrome-prod",
    includePopup: false,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest"
    ],
  },

  // Opera development (same as Chrome dev)
  "opera-dev": {
    name: "Browser Tracker Dev",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/opera-dev",
    includePopup: true,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest"
    ],
  },

  // Opera production (same as Chrome prod)
  "opera-prod": {
    name: "Browser Tracker",
    version: "1.0.0",
    description: "Developer tool for debugging and tracking browser activity on local server",
    manifestVersion: 3,
    outputDir: "dist/opera-prod",
    includePopup: false,
    permissions: [
      "tabs",
      "storage",
      "cookies",
      "webRequest"
    ],
  }
};
