#!/usr/bin/env bun
import { mkdir, rm, copyFile, writeFile, readFile, exists } from "fs/promises";
import { join } from "path";
import { configs, type BuildConfig } from "./build.config";

const SOURCE_DIR = "./browserTracker";

interface ManifestV2 {
  manifest_version: 2;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  background: {
    scripts: string[];
  };
  browser_action?: {
    default_popup: string;
    default_icon: {
      "16": string;
      "48": string;
      "128": string;
    };
  };
  icons: {
    "16": string;
    "48": string;
    "128": string;
  };
  browser_specific_settings?: {
    gecko?: {
      id: string;
      strict_min_version: string;
    };
  };
}

interface ManifestV3 {
  manifest_version: 3;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  host_permissions: string[];
  background: {
    service_worker: string;
  };
  action?: {
    default_popup: string;
    default_icon: {
      "16": string;
      "48": string;
      "128": string;
    };
  };
  icons: {
    "16": string;
    "48": string;
    "128": string;
  };
}

type Manifest = ManifestV2 | ManifestV3;

/**
 * Generates manifest.json based on configuration
 */
function generateManifest(config: BuildConfig): Manifest {
  const icons = {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  };

  if (config.manifestVersion === 2) {
    const manifest: ManifestV2 = {
      manifest_version: 2,
      name: config.name,
      version: config.version,
      description: config.description,
      permissions: config.permissions,
      background: {
        scripts: ["background.js"],
      },
      icons,
    };

    if (config.includePopup) {
      manifest.browser_action = {
        default_popup: "popup.html",
        default_icon: icons,
      };
    }

    if (config.browserSpecificSettings) {
      manifest.browser_specific_settings = config.browserSpecificSettings;
    }

    return manifest;
  } else {
    // Manifest V3
    const manifest: ManifestV3 = {
      manifest_version: 3,
      name: config.name,
      version: config.version,
      description: config.description,
      permissions: config.permissions,
      host_permissions: [
        "http://localhost/*",
        "http://127.0.0.1/*",
        "http://*/*",
        "https://*/*",
      ],
      background: {
        service_worker: "background.js",
      },
      icons,
    };

    if (config.includePopup) {
      manifest.action = {
        default_popup: "popup.html",
        default_icon: icons,
      };
    }

    return manifest;
  }
}

/**
 * Adapts background.js for manifest v3
 */
async function adaptBackgroundScript(
  sourceFile: string,
  targetFile: string,
  manifestVersion: number
): Promise<void> {
  let content = await readFile(sourceFile, "utf-8");

  if (manifestVersion === 3) {
    // Для manifest v3 не нужны изменения в API, т.к. chrome.* API совместим
    // Но если используется webRequest.onBeforeRequest с блокировкой,
    // нужно использовать declarativeNetRequest
    console.log("⚠️  Note: Manifest V3 requires declarativeNetRequest instead of webRequest blocking");
  }

  await writeFile(targetFile, content, "utf-8");
}

/**
 * Copies extension files
 */
async function copyExtensionFiles(
  sourceDir: string,
  targetDir: string,
  config: BuildConfig
): Promise<void> {
  const filesToCopy = [
    "background.js",
    "README.md",
  ];

  if (config.includePopup) {
    filesToCopy.push("popup.html", "popup.js");
  }

  // Копируем основные файлы
  for (const file of filesToCopy) {
    const source = join(sourceDir, file);
    const target = join(targetDir, file);

    if (await exists(source)) {
      if (file === "background.js") {
        await adaptBackgroundScript(source, target, config.manifestVersion);
      } else {
        await copyFile(source, target);
      }
    }
  }

  // Копируем icons
  const iconsSourceDir = join(sourceDir, "icons");
  const iconsTargetDir = join(targetDir, "icons");

  if (await exists(iconsSourceDir)) {
    await mkdir(iconsTargetDir, { recursive: true });

    const iconFiles = ["icon16.png", "icon48.png", "icon128.png"];
    for (const icon of iconFiles) {
      const source = join(iconsSourceDir, icon);
      const target = join(iconsTargetDir, icon);

      if (await exists(source)) {
        await copyFile(source, target);
      }
    }
  }
}

/**
 * Builds extension for specified configuration
 */
async function buildExtension(configName: string): Promise<void> {
  const config = configs[configName];

  if (!config) {
    console.error(`❌ Configuration "${configName}" not found`);
    return;
  }

  console.log(`\n🔨 Building ${configName}...`);

  // Удаляем старую сборку
  await rm(config.outputDir, { recursive: true, force: true });

  // Создаём директорию
  await mkdir(config.outputDir, { recursive: true });

  // Генерируем manifest
  const manifest = generateManifest(config);
  await writeFile(
    join(config.outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8"
  );

  // Копируем файлы
  await copyExtensionFiles(SOURCE_DIR, config.outputDir, config);

  console.log(`✅ Built ${configName} to ${config.outputDir}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("📦 Building all configurations...\n");
    
    for (const configName of Object.keys(configs)) {
      await buildExtension(configName);
    }

    console.log("\n✨ All builds completed!");
    console.log("\n📁 Output directories:");
    for (const [name, config] of Object.entries(configs)) {
      console.log(`   ${name}: ${config.outputDir}`);
    }
  } else {
    // Собираем только указанные конфигурации
    for (const configName of args) {
      await buildExtension(configName);
    }
  }
}

main().catch(console.error);
