import { spawn, exec } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import os from "os";
import { $ } from "bun";

export interface RemoteChromeOptions {
  chromePath?: string; // path to chrome executable
  port?: number; // remote debugging port
  userDataDir?: string;
  headless?: boolean;
  extraArgs?: string[];
  logFile?: string;
  timeoutMs?: number;
  host?: string;
}

/**
 * RemoteChromeProcess — запускает скрытый Chrome с указанными флагами
 * и умеет корректно завершать его (включая `taskkill` на Windows).
 */
export class RemoteBrowserProcess {
  private opts: Required<RemoteChromeOptions>;
  private pid?: number;
  private startedAt?: Date;

  constructor(options: RemoteChromeOptions = {}) {
    const defaultUserData = path.join(os.tmpdir(), "HiddenChrome");
    this.opts = {
      chromePath:
        options.chromePath || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      port: options.port || 9222,
      userDataDir: options.userDataDir || defaultUserData,
      headless: options.headless ?? true,
      extraArgs: options.extraArgs || [],
      logFile: options.logFile || path.join(process.cwd(), "start_chrome.log"),
      timeoutMs: options.timeoutMs || 5000,
      host: options.host || "localhost",
    };
  }

  public clearLogFile(): void {
    try {
      fs.writeFileSync(this.opts.logFile, "");
    } catch (e) {}
  }

  public async start(): Promise<void> {
    this.clearLogFile();

    // If port already occupied, consider Chrome already running
    if (await this.isPortInUse(this.opts.port, this.opts.host)) {
      // leave pid undefined because we didn't start it
      return;
    }

    // ensure user data dir exists
    try {
      fs.mkdirSync(this.opts.userDataDir, { recursive: true });
    } catch (e) {
      // ignore
    }

    const args = this.buildArgs();

    // spawn Chrome detached and hidden
    const child = spawn(this.opts.chromePath, args, {
      detached: true,
      //   stdio: "ignore",
      windowsHide: true,
    });

    // logging output
    child.on("error", (err) => {
      try {
        fs.appendFileSync(this.opts.logFile, `[ERROR] Failed to start Chrome: ${String(err)}\n`);
      } catch (e) {}
    });

    child.stdout?.on("data", (data) => {
      try {
        fs.appendFileSync(this.opts.logFile, `[STDOUT] ${data}\n`);
      } catch (e) {}
    });

    child.stderr?.on("data", (data) => {
      try {
        fs.appendFileSync(this.opts.logFile, `[STDERR] ${data}\n`);
      } catch (e) {}
    });

    // store pid and detach
    this.pid = child.pid;
    this.startedAt = new Date();
    child.unref();

    // wait for port to be ready (short timeout)
    const ok = await this.waitForPort(this.opts.port, this.opts.host, this.opts.timeoutMs);
    if (!ok) {
      // log a warning
      try {
        fs.appendFileSync(
          this.opts.logFile,
          `[WARN] Chrome did not open port ${this.opts.port} within ${this.opts.timeoutMs}ms\n`
        );
      } catch (e) {}
    } else {
      try {
        fs.appendFileSync(
          this.opts.logFile,
          `[INFO] Chrome started (pid=${this.pid}) on port ${this.opts.port}\n`
        );
      } catch (e) {}
    }
  }

  public async stop(): Promise<void> {
    if (!this.pid) {
      // if we didn't start Chrome, try to kill by port
      const pid = await this.findPidByPort(this.opts.port);
      if (!pid) return;
      await this.killPid(pid);
      return;
    }

    await this.killPid(this.pid);
    this.pid = undefined;
  }

  public async isRunning(): Promise<boolean> {
    // prefer port check
    if (await this.isPortInUse(this.opts.port, this.opts.host)) return true;

    if (!this.pid) return false;
    try {
      process.kill(this.pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  private buildArgs(): string[] {
    const args: string[] = [];

    if (this.opts.headless) {
      args.push("--headless=new");
    }

    args.push(`--remote-debugging-port=${this.opts.port}`);
    args.push(`--remote-debugging-address=0.0.0.0`);
    args.push(`--remote-allow-origins=*`);
    args.push(`--disable-web-security`);
    args.push(`--user-data-dir=${this.opts.userDataDir}`);
    args.push(`--no-first-run`);
    args.push(`--disable-gpu`);
    args.push(`--window-size=1920,1080`);

    if (this.opts.extraArgs.length) args.push(...this.opts.extraArgs);

    return args;
  }

  private waitForPort(port: number, host: string, timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    const interval = 200;
    return new Promise((resolve) => {
      const check = async () => {
        const ok = await this.isPortInUse(port, host);
        if (ok) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, interval);
      };
      check();
    });
  }

  private async isPortInUse(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      const onDone = (inUse: boolean) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(inUse);
        }
      };

      socket.setTimeout(4000);
      socket.once("connect", () => onDone(true));
      socket.once("timeout", () => onDone(false));
      socket.once("error", () => onDone(false));

      socket.connect(port, host);
    });
  }

  private async killPid(pid: number): Promise<void> {
    // best-effort kill; on Windows prefer taskkill to kill child tree
    try {
      if (process.platform === "win32") {
        await new Promise<void>((resolve, reject) => {
          exec(`taskkill /PID ${pid} /T /F`, (err) => (err ? reject(err) : resolve()));
        });
      } else {
        process.kill(pid, "SIGTERM");
      }

      // wait for it to die
      const start = Date.now();
      while (true) {
        try {
          process.kill(pid, 0);
          if (Date.now() - start > 3000) break;
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          break; // killed
        }
      }

      try {
        fs.appendFileSync(this.opts.logFile, `[INFO] Killed pid=${pid}\n`);
      } catch (e) {}
    } catch (e) {
      try {
        fs.appendFileSync(this.opts.logFile, `[ERROR] Failed to kill pid=${pid}: ${String(e)}\n`);
      } catch (err) {}
    }
  }

  private async findPidByPort(port: number): Promise<number | null> {
    // On Windows use netstat, on unix use lsof
    try {
      if (process.platform === "win32") {
        const out = await new Promise<string>((resolve, reject) => {
          exec(`netstat -ano | findstr :${port}`, (err, stdout) =>
            err ? reject(err) : resolve(stdout)
          );
        });
        const lines = out
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const pid = Number(parts[parts.length - 1]);
          if (!Number.isNaN(pid)) return pid;
        }
      } else {
        const out = await new Promise<string>((resolve, reject) => {
          exec(`lsof -i :${port} -t`, (err, stdout) => (err ? reject(err) : resolve(stdout)));
        });
        const pid = Number(out.trim().split(/\s+/)[0]);
        if (!Number.isNaN(pid)) return pid;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  public async killByArgs(match: string) {
    const pids = await $`ps aux | grep ${match} | grep -v grep | awk '{print $2}'`.text();

    for (const pid of pids.split("\n").filter(Boolean)) {
      await $`kill -9 ${pid}`;
      console.log("Killed PID:", pid);
    }
  }

  public async forceKillByPort(): Promise<void> {
    const pid = await this.findPidByPort(this.opts.port);

    console.log("Force killing PID on port", this.opts.port, ":", pid);
    
    if (pid) {
      await this.killPid(pid);
    }
  }
}
