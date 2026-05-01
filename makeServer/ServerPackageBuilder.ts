import { join, resolve, basename } from "path";
import { mkdir, rm, writeFile, copyFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { PackageBuilder } from "./PackageBuilder";
import { ZipArchive, Logger } from "@2byte/zip-archive";

export class ServerPackageBuilder {
  private _builder: PackageBuilder | null = null;

  constructor(private sourceDir?: string) {}

  /**
   * Set the package builder that defines what and how to pack.
   */
  public builder(b: PackageBuilder): this {
    this._builder = b;
    return this;
  }

  /**
   * Create a zip package from sourceDir using the configured builder.
   * @param name - Output archive name (without .zip)
   * @param outputPath - Directory to write the zip into
   */
  public async createPackage(name: string, outputPath: string): Promise<void> {
    if (!this._builder) {
      throw new Error("No builder set. Call .builder() before .createPackage().");
    }
    if (!this.sourceDir) {
      throw new Error("No sourceDir provided. Pass it to the constructor.");
    }

    const srcDir = resolve(this.sourceDir);
    const tempDir = join(outputPath, `__tmp_${name}_${Date.now()}`);
    const outZip = join(outputPath, `${name}.zip`);

    await mkdir(tempDir, { recursive: true });
    await mkdir(outputPath, { recursive: true });

    try {
      await this.copySourceFiles(srcDir, tempDir);
      await this.writeEnvFile(tempDir, ".env", this._builder.getEnvVars());
      await this.writeEnvFile(join(tempDir, "notify"), ".env", this._builder.getNotifyEnvVars());
      await this.writeBtrSettings(tempDir, this._builder.getBtrSettings());
      await this.writeInstallScript(tempDir);

      const zip = new ZipArchive({ logger: new Logger("./archiving.log"), ignores: this._builder.getIgnores() });

      const { data, extension } = zip.createArchiveFromDirectory(tempDir);

      await writeFile(outZip, data);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async copySourceFiles(srcDir: string, destDir: string): Promise<void> {
    const files = this._builder!.getFiles();

    for (const entry of files) {
      const src = join(srcDir, entry);
      const dest = join(destDir, entry);

      if (!existsSync(src)) {
        console.warn(`[ServerPackageBuilder] Skipping missing entry: ${entry}`);
        continue;
      }

      const info = await stat(src);

      if (info.isDirectory()) {
        await this.copyDirRecursive(src, dest);
      } else {
        await mkdir(join(dest, ".."), { recursive: true });
        await copyFile(src, dest);
      }
    }
  }

  private async writeEnvFile(
    dir: string,
    filename: string,
    vars: Record<string, string>
  ): Promise<void> {
    if (Object.keys(vars).length === 0) return;

    await mkdir(dir, { recursive: true });

    const content = Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    await writeFile(join(dir, filename), content, "utf-8");
  }

  private async writeBtrSettings(tempDir: string, settings: Record<string, any>): Promise<void> {
    if (Object.keys(settings).length === 0) return;

    const dbDir = join(tempDir, "notify", "database");
    await mkdir(dbDir, { recursive: true });
    await writeFile(join(dbDir, "btr-settings.json"), JSON.stringify(settings, null, 2), "utf-8");
  }

  /**
   * Generate install.ts — runs inside the deployed package to install
   * dependencies, run migrations and apply initial BtrSettings.
   */
  private async writeInstallScript(tempDir: string): Promise<void> {
    const script = `#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import { appendFileSync, writeFileSync, readFileSync } from "fs";
import { existsSync } from "fs";

const root = import.meta.dir;
const notifyDir = join(root, "notify");
const logPath = join(root, "install.log");

writeFileSync(logPath, "");

const log = (msg: string) => {
  const line = \`[\${new Date().toISOString()}] \${msg}\\n\`;
  process.stdout.write(line);
  appendFileSync(logPath, line);
};

const run = async (cmd: string[], cwd: string) => {
  log(\`> \${cmd.join(" ")} (in \${cwd})\`);
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  await proc.exited;
  if (out) appendFileSync(logPath, out);
  if (err) appendFileSync(logPath, err);
  if (proc.exitCode !== 0) {
    throw new Error(\`Command failed with exit code \${proc.exitCode}\\n\${err}\`);
  }
};

try {
  log("=== BTR Server Installation ===");

  log("Installing root dependencies...");
  await run(["bun", "install"], root);

  log("Installing notify dependencies...");
  await run(["bun", "install"], notifyDir);

  log("Running migrations...");
  await run(["bun", "database/migrate.ts"], notifyDir);

  log("Applying BtrSettings...");
  const settingsPath = join(notifyDir, "database", "btr-settings.json");

  if (existsSync(settingsPath)) {
    const { BtrSetting } = await import("./notify/models/BtrSetting.ts");
    const dbConnector = (await import("./notify/database/dbConnector.ts")).default;
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    BtrSetting.setDatabase(dbConnector());
    await BtrSetting.setSettings(settings);
    log("BtrSettings applied.");
  } else {
    log("No btr-settings.json found, skipping settings apply.");
  }

  log("=== Installation complete! ===");
} catch (err) {
  log(\`ERROR: \${err}\`);
  process.exit(1);
}
`;

    await writeFile(join(tempDir, "install.ts"), script, "utf-8");
  }

  private async copyDirRecursive(src: string, dest: string): Promise<void> {
    const entries = await readdir(src, { withFileTypes: true });
    await mkdir(dest, { recursive: true });

    for (const entry of entries) {
      if (entry.name === "node_modules") continue;

      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }
}
