#!/usr/bin/env bun
import { join } from "path";
import { mkdir } from "fs/promises";

/**
 * Packs built extensions into zip archives
 */
async function packExtensions() {
  const distDir = "dist";
  const packDir = "packed";
  
  const builds = [
    "firefox-dev",
    "firefox-prod",
    "chrome-dev",
    "chrome-prod",
    "opera-dev",
    "opera-prod"
  ];

  console.log("📦 Packing extensions...\n");

  // Создаём директорию для упакованных файлов
  await mkdir(packDir, { recursive: true });

  for (const build of builds) {
    const sourceDir = join(distDir, build);
    const outputFile = join(packDir, `${build}.zip`);

    console.log(`🗜️  Packing ${build}...`);

    // Используем Bun для создания zip архива
    const proc = Bun.spawn([
      "powershell",
      "-Command",
      `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${outputFile}" -Force`
    ]);

    await proc.exited;

    if (proc.exitCode === 0) {
      console.log(`✅ Packed ${build} to ${outputFile}`);
    } else {
      console.error(`❌ Failed to pack ${build}`);
    }
  }

  console.log("\n✨ All extensions packed!");
  console.log(`📁 Output directory: ${packDir}/`);
}

packExtensions().catch(console.error);
