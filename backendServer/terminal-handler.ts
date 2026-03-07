/**
 * Terminal Handler for Client
 *
 * Manages PTY (Pseudo Terminal) sessions on the client side
 * Handles creation, input/output, and lifecycle of terminal sessions
 */

import { existsSync } from "fs";
import { spawn, type IExitEvent } from "bun-pty";

interface PTYProcess {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  pid?: number;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitEvent: IExitEvent) => void) => void;
}

interface TerminalSessionData {
  sessionId: string;
  pty: PTYProcess | any;
  shell: string;
  cols: number;
  rows: number;
  cwd?: string;
}

/**
 * Create PTY process using available method
 */
function createPTY(options: {
  shell: string;
  cols: number;
  rows: number;
  cwd?: string;
  env?: Record<string, string>;
}): PTYProcess {
  const actualCwd = options.cwd || process.env.HOME || process.cwd();
  console.log(`[TerminalHandler] Creating PTY with options:`, {
    shell: options.shell,
    cols: options.cols,
    rows: options.rows,
    cwd: actualCwd,
  });

  // Allow disabling node-pty via environment variable
  // Note: node-pty EventEmitter doesn't work well with Bun runtime, use Bun.spawn instead
  const useNodePty = process.env.USE_NODE_PTY === "true"; // Changed: disabled by default

  if (!useNodePty) {
    console.log(`ℹ️ [TerminalHandler] Using Bun.spawn (node-pty disabled for Bun compatibility)`);
  }

  // Prepare shell arguments based on shell type
  const shellArgs: string[] = [];
  const shellLower = options.shell.toLowerCase();

  if (shellLower.includes("powershell") || shellLower.includes("pwsh")) {
    // PowerShell: -NoProfile = don't load profile (faster, more stable)
    shellArgs.push("-NoProfile");
  } else if (shellLower.includes("cmd.exe")) {
    // cmd.exe: /K = keep alive (removed /Q to see banner and confirm PTY works)
    // Note: cmd.exe does NOT echo input until Enter is pressed
    shellArgs.push("/K");
  }
  // cmd.exe and bash don't need args for PTY mode

  console.log(`[TerminalHandler] Shell arguments for PTY:`, shellArgs);

  // Try bun-pty FIRST (native for Bun runtime)
  try {
    console.log(`[TerminalHandler] Trying bun-pty...`);

    // Storage for handlers that will be registered later
    let dataHandlers: Array<(data: string) => void> = [];
    let exitHandlers: Array<(exitEvent: IExitEvent) => void> = [];
    let isAlive = true;

    // Convert all args to strings (bun-pty expects string[] not mixed types)
    const stringArgs = shellArgs.map((arg) => String(arg));
    console.log(`[TerminalHandler] Converting args to strings:`, stringArgs);

    // Convert all env values to strings (bun-pty uses .replace() on env values)
    const stringEnv: Record<string, string> = {};
    let filteredCount = 0;
    for (const [key, value] of Object.entries({ ...process.env, ...options.env })) {
      if (value !== undefined && value !== null) {
        const stringValue = String(value);
        if (typeof stringValue === "string" && stringValue.length > 0) {
          stringEnv[key] = stringValue;
        } else {
          filteredCount++;
        }
      } else {
        filteredCount++;
      }
    }
    console.log(
      `[TerminalHandler] Env variables: ${Object.keys(stringEnv).length}, filtered: ${filteredCount}`
    );

    console.log(`[TerminalHandler] Calling bun-pty spawn with:`, {
      command: options.shell,
      args: stringArgs,
      cwd: actualCwd,
      envCount: Object.keys(stringEnv).length,
    });

    // bun-pty API: spawn(file, args, options)
    const ptyProcess = spawn(options.shell, stringArgs, {
      name: "xterm-256color",
      cwd: actualCwd,
      env: stringEnv,
      cols: options.cols,
      rows: options.rows,
    });

    console.log(`✅ [TerminalHandler] Created PTY with bun-pty (pid: ${ptyProcess.pid})`);
    console.log(`   Shell: ${options.shell}, Args:`, shellArgs);

    // Register handlers for bun-pty callbacks
    ptyProcess.onData((data: string) => {
      console.log(`[TerminalHandler] 🎉 bun-pty data received: ${data.length} bytes`);
      console.log(
        `[TerminalHandler] Data preview: ${JSON.stringify(data.substring(0, Math.min(50, data.length)))}`
      );

      // Call all registered handlers
      dataHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error("[TerminalHandler] Error in data handler:", err);
        }
      });
    });

    ptyProcess.onExit((exitEvent: IExitEvent) => {
      console.log(`📤 [TerminalHandler] bun-pty process exited with code ${exitEvent.exitCode}`);
      isAlive = false;

      // Call all registered exit handlers
      exitHandlers.forEach((handler) => {
        try {
          handler(exitEvent);
        } catch (err) {
          console.error("[TerminalHandler] Error in exit handler:", err);
        }
      });
    });

    // Test PTY after a short delay
    setTimeout(() => {
      if (!isAlive) {
        console.error(`❌ [TerminalHandler] bun-pty process died within 500ms!`);
      } else {
        console.log(`✅ [TerminalHandler] bun-pty process ${ptyProcess.pid} is still alive`);
        console.log(`[TerminalHandler] 🧪 Testing bun-pty by sending "ver\\r"`);
        try {
          ptyProcess.write("ver\r");
          console.log(`[TerminalHandler] Test command sent`);
        } catch (err) {
          console.error(`❌ [TerminalHandler] Failed to send test command:`, err);
        }
      }
    }, 500);

    // Return PTY wrapper
    return {
      write: (data: string) => {
        if (!isAlive) {
          console.warn(`⚠️ [TerminalHandler] Cannot write - bun-pty process is dead`);
          return;
        }
        try {
          ptyProcess.write(data);
        } catch (err) {
          console.error(`❌ [TerminalHandler] bun-pty write error:`, err);
        }
      },
      resize: (cols: number, rows: number) => {
        if (!isAlive) return;
        try {
          ptyProcess.resize(cols, rows);
        } catch (err) {
          console.error(`❌ [TerminalHandler] bun-pty resize error:`, err);
        }
      },
      kill: (signal?: string) => {
        isAlive = false;
        try {
          ptyProcess.kill();
        } catch (err) {
          console.error(`❌ [TerminalHandler] bun-pty kill error:`, err);
        }
      },
      pid: ptyProcess.pid,
      onData: (callback) => {
        dataHandlers.push(callback);
        console.log(
          `[TerminalHandler] Registered data handler for bun-pty (total: ${dataHandlers.length})`
        );
      },
      onExit: (callback) => {
        exitHandlers.push(callback);
      },
    };
  } catch (bunPtyErr) {
    console.log(
      `⚠️ [TerminalHandler] bun-pty not available:`,
      bunPtyErr instanceof Error ? bunPtyErr.message : bunPtyErr
    );
  }

  // Try to use node-pty as fallback - unless disabled
  if (useNodePty) {
    try {
      // @ts-ignore - optional dependency
      const pty = require("node-pty");

      const ptyProcess = pty.spawn(options.shell, shellArgs, {
        name: "xterm-256color",
        cols: options.cols,
        rows: options.rows,
        cwd: actualCwd,
        env: { ...process.env, ...options.env },
        // Use WinPTY instead of ConPTY - ConPTY has socket issues on Windows
        useConpty: false,
      });

      console.log(`✅ [TerminalHandler] Created PTY with node-pty (pid: ${ptyProcess.pid})`);
      console.log(`   Using WinPTY backend (useConpty: false)`);
      console.log(`   Shell: ${options.shell}, Args:`, shellArgs);

      // Monitor PTY process health
      let isAlive = true;
      let exitHandlers: Array<(code: number) => void> = [];
      let dataHandlers: Array<(data: string) => void> = [];

      // Register data handler IMMEDIATELY - try BOTH methods (onData and .on('data'))
      console.log(`[TerminalHandler] About to register PTY data handlers...`);
      console.log(`[TerminalHandler] ptyProcess type:`, typeof ptyProcess);
      console.log(`[TerminalHandler] Has onData:`, typeof ptyProcess.onData);
      console.log(`[TerminalHandler] Has .on:`, typeof ptyProcess.on);

      // Try event-based handler first (Node.js EventEmitter pattern)
      if (typeof ptyProcess.on === "function") {
        console.log(`[TerminalHandler] Trying .on('data') handler...`);
        ptyProcess.on("data", (data: string) => {
          console.log(
            `[TerminalHandler] 🎉 PTY.on('data') received ${data.length} bytes from pid ${ptyProcess.pid}`
          );
          console.log(
            `[TerminalHandler] Data preview: ${JSON.stringify(data.substring(0, Math.min(50, data.length)))}`
          );
          console.log(`[TerminalHandler] Number of registered handlers: ${dataHandlers.length}`);

          // Call all registered handlers
          dataHandlers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error("[TerminalHandler] Error in data handler:", err);
            }
          });
        });
        console.log(`[TerminalHandler] ✅ .on('data') handler registered`);
      }

      // Also try onData method
      if (typeof ptyProcess.onData === "function") {
        console.log(`[TerminalHandler] Trying onData() handler...`);
        ptyProcess.onData((data: string) => {
          console.log(
            `[TerminalHandler] 🎉 PTY.onData received ${data.length} bytes from pid ${ptyProcess.pid}`
          );
          console.log(
            `[TerminalHandler] Data preview: ${JSON.stringify(data.substring(0, Math.min(50, data.length)))}`
          );

          // Call all registered handlers
          dataHandlers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error("[TerminalHandler] Error in data handler:", err);
            }
          });
        });
        console.log(`[TerminalHandler] ✅ onData() handler registered`);
      }

      // Try to access and handle internal socket errors (Windows conpty)
      try {
        // @ts-ignore - accessing internal property
        const socket = ptyProcess._socket || ptyProcess.socket;
        if (socket && socket.on) {
          socket.on("error", (err: Error) => {
            console.error(`❌ [TerminalHandler] PTY socket error:`, err);
            isAlive = false;
          });
          socket.on("close", () => {
            console.warn(`⚠️ [TerminalHandler] PTY socket closed`);
            isAlive = false;
          });
        }
      } catch (err) {
        // Couldn't access internal socket - not critical
      }

      // Handle PTY errors at top level
      if (ptyProcess.on) {
        ptyProcess.on("error", (err: Error) => {
          console.error(`❌ [TerminalHandler] PTY error for pid ${ptyProcess.pid}:`, err);
          isAlive = false;
        });
      }

      // Monitor PTY exit immediately
      ptyProcess.onExit((exitInfo: any) => {
        const exitCode = typeof exitInfo === "object" ? exitInfo.exitCode : exitInfo;
        console.warn(
          `⚠️ [TerminalHandler] PTY process ${ptyProcess.pid} exited with code ${exitCode}`
        );
        console.warn(`   Shell was: ${options.shell}`);
        console.warn(`   Args were:`, shellArgs);
        isAlive = false;

        // Call registered exit handlers
        exitHandlers.forEach((handler) => {
          try {
            handler(exitCode);
          } catch (err) {
            console.error(`❌ [TerminalHandler] Error in exit handler:`, err);
          }
        });
      });

      // Check if process is still alive after a short delay
      setTimeout(() => {
        console.log(`[TerminalHandler] ⏱️ 500ms timeout triggered for pid ${ptyProcess.pid}`);
        if (!isAlive) {
          console.error(`❌ [TerminalHandler] PTY process died within 500ms of creation!`);
          console.error(`   This usually means the shell immediately exited.`);
          console.error(`   Shell: ${options.shell}, Args:`, shellArgs);
        } else {
          console.log(
            `✅ [TerminalHandler] PTY process ${ptyProcess.pid} is still alive after 500ms`
          );

          // Test: send a test string to PTY to verify echo works
          console.log(
            `[TerminalHandler] 🧪 Testing PTY echo by sending "ver\\r" (gets Windows version)`
          );
          try {
            // Use 'ver' command instead of 'echo test' - it should output immediately
            ptyProcess.write("ver\r");
            console.log(`[TerminalHandler] Test command sent to PTY`);
          } catch (testErr) {
            console.error(`❌ [TerminalHandler] Failed to write test command:`, testErr);
          }
        }
      }, 500);

      // Wrap write with additional protection
      const safeWrite = (data: string) => {
        console.log(
          `[TerminalHandler] safeWrite called: isAlive=${isAlive}, data=${JSON.stringify(data)}, pid=${ptyProcess.pid}`
        );

        if (!isAlive) {
          console.warn(`⚠️ [TerminalHandler] Cannot write - PTY process is dead`);
          return;
        }

        // Double-check if process actually exists (skip this check for now - too slow)
        /*
      try {
        if (ptyProcess.pid) {
          const checkResult = Bun.spawnSync(['tasklist', '/FI', `PID eq ${ptyProcess.pid}`, '/NH'], {
            stdout: 'pipe',
            stderr: 'pipe',
          });
          const output = new TextDecoder().decode(checkResult.stdout);
          
          if (!output.includes(`${ptyProcess.pid}`)) {
            console.warn(`⚠️ [TerminalHandler] PTY process ${ptyProcess.pid} no longer exists in tasklist`);
            isAlive = false;
            return;
          }
        }
      } catch (checkErr) {
        // Ignore check errors, try to write anyway
      }
      */

        try {
          console.log(`[TerminalHandler] Calling ptyProcess.write()...`);

          // Wrap write in try-catch to handle async socket errors from ConPTY/WinPTY
          try {
            ptyProcess.write(data);
            console.log(`[TerminalHandler] ptyProcess.write() completed successfully`);
          } catch (writeErr: any) {
            // Ignore socket closed errors - they're async and don't affect actual write
            if (
              writeErr?.code === "ERR_SOCKET_CLOSED" ||
              writeErr?.message?.includes("Socket is closed")
            ) {
              console.warn(
                `⚠️ [TerminalHandler] Socket closed error during write (ignoring):`,
                writeErr.message
              );
              // Don't mark as dead - PTY might still be working
            } else {
              throw writeErr; // Re-throw other errors
            }
          }
        } catch (err: any) {
          console.error(`❌ [TerminalHandler] PTY write error:`, err);
          isAlive = false;
        }
      };

      return {
        write: safeWrite,
        resize: (cols: number, rows: number) => {
          if (!isAlive) return;
          ptyProcess.resize(cols, rows);
        },
        kill: (signal?: string) => {
          isAlive = false;
          ptyProcess.kill(signal);
        },
        pid: ptyProcess.pid,
        onData: (callback) => {
          // Add callback to handlers array - real onData already registered above
          console.log(
            `[TerminalHandler] Registering data handler (total: ${dataHandlers.length + 1})`
          );
          dataHandlers.push(callback);
        },
        onExit: (callback) => {
          // Add to exit handlers array so it gets called when PTY exits
          exitHandlers.push(callback);
        },
      };
    } catch (err) {
      console.log(`⚠️ [TerminalHandler] node-pty not available, using Bun.spawn fallback:`, err);
    }
  } // end if (useNodePty)

  console.log(`⚠️ [TerminalHandler] Using FALLBACK mode (Bun.spawn without PTY)`);

  // Fallback: Use Bun.spawn with stdio pipes (not true PTY, but works)
  // Prepare shell arguments for non-PTY mode
  const fallbackArgs: string[] = [];

  if (shellLower.includes("cmd.exe")) {
    // cmd.exe: /K = keep alive, /Q = quiet
    fallbackArgs.push("/K");
  } else if (shellLower.includes("powershell") || shellLower.includes("pwsh")) {
    // PowerShell: -NoLogo = no startup banner, -NoExit = keep shell open
    fallbackArgs.push("-NoLogo", "-NoExit");
  } else if (shellLower.includes("bash")) {
    // Bash: -i = interactive
    fallbackArgs.push("-i");
  }

  console.log(
    `⚠️ [TerminalHandler] Creating Bun.spawn fallback: ${options.shell} ${fallbackArgs.join(" ")}`
  );

  const proc = Bun.spawn([options.shell, ...fallbackArgs], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    cwd: options.cwd || process.env.HOME || process.cwd(),
    env: {
      ...process.env,
      ...options.env,
      // Disable shell coloring/prompts that might interfere
      TERM: "dumb",
    },
  });

  console.log(`⚠️ [TerminalHandler] Created fallback process (pid: ${proc.pid})`);

  // Test fallback after a short delay
  setTimeout(() => {
    console.log(
      `[TerminalHandler] 🧪 Testing Bun.spawn fallback by sending "echo Hello from PTY\\r"`
    );
    try {
      proc.stdin.write("echo Hello from PTY\r");
      console.log(`[TerminalHandler] Test command sent to fallback`);
    } catch (err) {
      console.error(`❌ [TerminalHandler] Failed to send test command:`, err);
    }
  }, 500);

  // Setup stdio streaming
  const callbacks: ((data: string) => void)[] = [];
  const exitCallbacks: ((code: number) => void)[] = [];

  // Read stdout using stream reader (better for real-time data)
  const readStdout = async () => {
    try {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        console.log(`[TerminalHandler] 🎉 Fallback stdout: ${text.length} bytes`);
        console.log(
          `[TerminalHandler] Data preview: ${JSON.stringify(text.substring(0, Math.min(50, text.length)))}`
        );
        console.log(`[TerminalHandler] Number of callbacks: ${callbacks.length}`);

        callbacks.forEach((cb) => {
          try {
            cb(text);
          } catch (err) {
            console.error("[TerminalHandler] Callback error:", err);
          }
        });
      }
    } catch (e) {
      console.warn("[TerminalHandler] stdout stream ended:", e);
    }
  };
  readStdout();

  // Read stderr using stream reader
  const readStderr = async () => {
    try {
      const reader = proc.stderr.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        console.log(`[TerminalHandler] Fallback stderr: ${text.length} bytes`);
        callbacks.forEach((cb) => {
          try {
            cb(text);
          } catch (err) {
            console.error("[TerminalHandler] Callback error:", err);
          }
        });
      }
    } catch (e) {
      console.warn("[TerminalHandler] stderr stream ended:", e);
    }
  };
  readStderr();

  // Wait for exit
  proc.exited.then((exitCode) => {
    exitCallbacks.forEach((cb) => cb(exitCode || 0));
  });

  return {
    write: (data: string) => {
      try {
        console.log(`[TerminalHandler] Fallback writing: ${JSON.stringify(data)}`);
        proc.stdin.write(data);
      } catch (e) {
        console.error("[TerminalHandler] Failed to write to stdin:", e);
      }
    },
    resize: (cols: number, rows: number) => {
      // Not supported in fallback mode
      console.warn("[TerminalHandler] Resize not supported in fallback mode");
    },
    kill: (signal?: string) => {
      proc.kill();
    },
    pid: proc.pid,
    onData: (callback) => {
      callbacks.push(callback);
      console.log(
        `[TerminalHandler] Registered data handler for Bun.spawn fallback (total: ${callbacks.length})`
      );
    },
    onExit: (callback) => {
      exitCallbacks.push(callback);
    },
  };
}

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd: string): boolean {
  try {
    const result = Bun.spawnSync(process.platform === "win32" ? ["where", cmd] : ["which", cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get default shell for current platform
 */
function getDefaultShell(): string {
  if (process.platform === "win32") {
    // For Windows, try these options in order of preference
    // cmd.exe works best with WinPTY (useConpty: false)
    const shellOptions = [
      "cmd.exe", // Most reliable with WinPTY
      "powershell.exe", // Works with ConPTY but has socket issues
      "pwsh.exe", // PowerShell Core
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe", // Git Bash
      "C:\\Program Files\\Git\\bin\\bash.exe",
    ];

    for (const shell of shellOptions) {
      // For full paths, check if file exists
      if (shell.includes("\\") || shell.includes("/")) {
        if (existsSync(shell)) {
          console.log(`[TerminalHandler] Using shell: ${shell}`);
          return shell;
        }
      } else {
        // For command names, check if they exist in PATH
        if (commandExists(shell)) {
          console.log(`[TerminalHandler] Using shell: ${shell}`);
          return shell;
        }
      }
    }

    console.warn(`[TerminalHandler] No preferred shell found, defaulting to cmd.exe`);
    return "cmd.exe";
  } else {
    // Unix-like systems
    return process.env.SHELL || "/bin/bash";
  }
}

/**
 * Terminal session storage
 */
export const terminalSessions = new Map<string, TerminalSessionData>();

/**
 * Message sender function type
 */
type SendMessageFn = (message: any) => void;

/**
 * Create a new terminal session
 *
 * @param sessionId - Unique session identifier
 * @param options - Terminal options
 * @param sendMessage - Function to send messages back to server
 */
export function createTerminalSession(
  sessionId: string,
  options: {
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
    shell?: string;
  },
  sendMessage: SendMessageFn
): void {
  console.log(`\n🖥️ [TerminalHandler] Creating terminal session: ${sessionId}`);

  // Create safe wrapper for sendMessage to prevent crashes
  const safeSendMessage = (message: any) => {
    try {
      console.log(
        `[TerminalHandler] safeSendMessage called, type: ${message.type}, session: ${sessionId}`
      );
      sendMessage(message);
      console.log(`[TerminalHandler] sendMessage() completed successfully`);
    } catch (err) {
      console.error(`❌ [TerminalHandler] Failed to send message for session ${sessionId}:`, err);
      console.error(`[TerminalHandler] Message was:`, message);
    }
  };

  const shell = options.shell || getDefaultShell();
  const cols = options.cols || 80;
  const rows = options.rows || 24;

  try {
    // Create PTY process
    const pty = createPTY({
      shell,
      cols,
      rows,
      cwd: options.cwd,
      env: options.env,
    });

    console.log(`[TerminalHandler] PTY created successfully, type:`, typeof pty);
    console.log(`[TerminalHandler] PTY has methods:`, Object.keys(pty));

    // Store session
    terminalSessions.set(sessionId, {
      sessionId,
      pty,
      shell,
      cols,
      rows,
      cwd: options.cwd,
    });

    console.log(`[TerminalHandler] Session stored, now registering output handler...`);
    console.log(`[TerminalHandler] pty object:`, typeof pty, "onData:", typeof pty.onData);

    // Handle PTY output
    pty.onData((data: string) => {
      console.log(`[TerminalHandler] PTY output for session ${sessionId}: ${data.length} bytes`);
      console.log(`[TerminalHandler] Calling safeSendMessage with terminal:output...`);
      safeSendMessage({
        type: "terminal:output",
        sessionId,
        data,
      });
      console.log(`[TerminalHandler] safeSendMessage completed`);
    });

    // Handle PTY exit
    pty.onExit((exitCode: number) => {
      console.log(`📤 [TerminalHandler] Session ${sessionId} exited with code ${exitCode}`);

      safeSendMessage({
        type: "terminal:exit",
        sessionId,
        exitCode,
      });

      // Cleanup
      terminalSessions.delete(sessionId);
    });

    console.log(
      `✅ [TerminalHandler] Session created: ${sessionId} (shell: ${shell}, size: ${cols}x${rows})`
    );

    // Send confirmation
    safeSendMessage({
      type: "terminal:ready",
      sessionId,
      shell,
      cols,
      rows,
      pid: pty.pid,
    });
  } catch (err) {
    console.error(`❌ [TerminalHandler] Failed to create session ${sessionId}:`, err);

    safeSendMessage({
      type: "terminal:error",
      sessionId,
      error: `Failed to create terminal: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/**
 * Send input to a terminal session
 *
 * @param sessionId - Session identifier
 * @param data - Input data to send
 */
export function sendTerminalInput(sessionId: string, data: string): void {
  const session = terminalSessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ [TerminalHandler] Session not found: ${sessionId}`);
    return;
  }

  console.log(`[TerminalHandler] Writing to session ${sessionId}: ${JSON.stringify(data)}`);

  try {
    // Check if PTY is still writable
    if (!session.pty) {
      console.error(`❌ [TerminalHandler] PTY is null for session ${sessionId}`);
      return;
    }

    // Check pid to see if process is alive
    const hasValidPid = session.pty.pid !== undefined && session.pty.pid > 0;
    console.log(`[TerminalHandler] PTY pid: ${session.pty.pid}, valid: ${hasValidPid}`);

    if (!hasValidPid) {
      console.warn(`⚠️ [TerminalHandler] PTY process appears to be dead (no valid pid)`);
      // Try to write anyway, it might work
    }

    session.pty.write(data);
    console.log(`✅ [TerminalHandler] Successfully wrote to session ${sessionId}`);
  } catch (err: any) {
    const isSocketClosed =
      err?.code === "ERR_SOCKET_CLOSED" || err?.message?.includes("Socket is closed");

    if (isSocketClosed) {
      console.error(
        `❌ [TerminalHandler] PTY socket closed for session ${sessionId} - process has exited`
      );
      // Clean up dead session
      terminalSessions.delete(sessionId);
    } else {
      console.error(`❌ [TerminalHandler] Failed to write to session ${sessionId}:`, err);
    }

    // Don't throw - just log the error to prevent client crash
  }
}

/**
 * Resize a terminal session
 *
 * @param sessionId - Session identifier
 * @param cols - New column count
 * @param rows - New row count
 */
export function resizeTerminalSession(sessionId: string, cols: number, rows: number): void {
  const session = terminalSessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ [TerminalHandler] Session not found: ${sessionId}`);
    return;
  }

  try {
    session.pty.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
    console.log(`📐 [TerminalHandler] Resized session ${sessionId}: ${cols}x${rows}`);
  } catch (err) {
    console.error(`❌ [TerminalHandler] Failed to resize session ${sessionId}:`, err);
  }
}

/**
 * Close a terminal session
 *
 * @param sessionId - Session identifier
 */
export function closeTerminalSession(sessionId: string): void {
  const session = terminalSessions.get(sessionId);

  if (!session) {
    console.warn(`⚠️ [TerminalHandler] Session not found: ${sessionId}`);
    return;
  }

  try {
    session.pty.kill();
    terminalSessions.delete(sessionId);
    console.log(`🔚 [TerminalHandler] Closed session: ${sessionId}`);
  } catch (err) {
    console.error(`❌ [TerminalHandler] Failed to close session ${sessionId}:`, err);
  }
}

/**
 * Get active terminal sessions
 *
 * @returns Array of session IDs
 */
export function getActiveSessions(): string[] {
  return Array.from(terminalSessions.keys());
}

/**
 * Close all terminal sessions
 */
export function closeAllSessions(): void {
  console.log(`🔚 [TerminalHandler] Closing all ${terminalSessions.size} sessions...`);

  for (const sessionId of terminalSessions.keys()) {
    closeTerminalSession(sessionId);
  }
}

/**
 * Get session information
 *
 * @param sessionId - Session identifier
 * @returns Session info or undefined
 */
export function getSessionInfo(sessionId: string) {
  const session = terminalSessions.get(sessionId);

  if (!session) {
    return undefined;
  }

  return {
    sessionId: session.sessionId,
    shell: session.shell,
    cols: session.cols,
    rows: session.rows,
    cwd: session.cwd,
    pid: session.pty.pid,
  };
}
