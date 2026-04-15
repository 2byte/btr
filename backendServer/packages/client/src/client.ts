// client.ts
// Подключаемся к RemoteServer

// Global error handlers to prevent client crashes from PTY errors
process.on('uncaughtException', (err: Error) => {
  console.error('❌ [Client] Uncaught exception:', err);
  
  // Check if it's a PTY socket error
  if (err.message?.includes('Socket is closed') || (err as any).code === 'ERR_SOCKET_CLOSED') {
    console.warn('⚠️ [Client] PTY socket closed error caught - continuing...');
    // Don't exit - just log and continue
    return;
  }
  
  // For other errors, log but don't crash
  console.error('⚠️ [Client] Continuing despite error...');
});

process.on('unhandledRejection', (reason: any) => {
  console.error('❌ [Client] Unhandled rejection:', reason);
});

import {
  createTerminalSession,
  sendTerminalInput,
  resizeTerminalSession,
  closeTerminalSession,
  closeAllSessions as closeAllTerminalSessions,
  getActiveSessions as getActiveTerminalSessions,
} from './terminal-handler';

import { readdir, readFile, mkdir, unlink, rmdir, rename, stat, writeFile, realpath } from 'fs/promises';
import { join, basename, dirname, resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { MorphShift } from './utils/MorphShift';

const WS_URL = new MorphShift(3).from(process.env.WS_URL) || "ws://127.0.0.1:8080";
const API_TOKEN = new MorphShift(3).from(process.env.API_TOKEN) || process.argv[2] || ""; // Authentication token

let ws: WebSocket | null = null;
let reconnectTimer: Timer | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = -1; // -1 = бесконечно

// Храним запущенные команды, чтобы можно было их прервать
const runningCommands = new Map<string, { proc: any; command: string }>();

/**
 * Подключается к WebSocket серверу
 */
function connect() {
  try {
    console.log(`🔗 [Client] Подключаюсь к ${WS_URL}...`);
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("✅ [Client] Подключён к серверу");
      reconnectAttempts = 0;
      
      const clientName = new MorphShift(3).from(process.env.CLIENT_NAME) || `remote-${process.platform}-${crypto.randomUUID().slice(0, 6)}`;

      // Представляемся серверу с токеном аутентификации
      sendMessage({
        type: "hello",
        name: clientName,
        os: process.platform,
        arch: process.arch,
        token: API_TOKEN || undefined, // Include token if provided
      });

      // Сбрасываем таймер переподключения
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        handleMessage(data);
      } catch (err) {
        console.error("[Client] Ошибка обработки сообщения:", err);
        console.error("[Client] Проблемное сообщение:", event.data);
      }
    };

    ws.onclose = (event) => {
      console.log(`🔌 [Client] Соединение закрыто (code: ${event.code}, reason: ${event.reason || 'none'}, wasClean: ${event.wasClean})`);
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("[Client] WebSocket ошибка:", err);
      console.error("[Client] WebSocket state:", ws?.readyState);
      scheduleReconnect();
    };
  } catch (err) {
    console.error("[Client] Ошибка подключения:", err);
    scheduleReconnect();
  }
}

/**
 * Обработчик входящих сообщений
 */
function handleMessage(data: any) {
  const type = data.type as string;

  switch (type) {
    case "welcome":
      console.log(`👋 [Client] ${data.message}`);
      console.log(`   ID вашего клиента: ${data.clientId}`);
      break;

    case "command":
      // Поддерживаем как простую строковую команду, так и объектный формат
      // { command: string, execId?: string } или { action: 'kill', execId }
      if (data.action === 'kill' && data.execId) {
        console.log(`🛑 [Client] Получен запрос kill для ${data.execId}`);
        killCommand(data.execId);
        break;
      }

      const incomingCommand = typeof data.command === 'string'
        ? data.command
        : data.command?.command || data.command?.cmd || null;

      if (incomingCommand) {
        const execId = typeof data.execId === 'string' ? data.execId : undefined;
        console.log(`📥 [Client] Получена команда: ${incomingCommand} (execId=${execId || 'new'})`);
        executeCommand(incomingCommand, execId);
      } else {
        console.warn('[Client] Команда не распознана:', data);
      }

      break;

    case "ping":
      console.log("📍 [Client] Ping от сервера");
      sendMessage({ type: "pong" });
      break;

    case "broadcast":
      console.log(`📢 [Client] Broadcast: ${data.message}`);
      break;

    case "error":
      console.error(`❌ [Client] Ошибка сервера: ${data.message}`);
      break;

    // Terminal session messages
    case "terminal:create":
      console.log(`🖥️ [Client] Creating terminal session: ${data.sessionId}`);
      createTerminalSession(data.sessionId, {
        cols: data.cols,
        rows: data.rows,
        cwd: data.cwd,
        env: data.env,
        shell: data.shell,
      }, sendMessage);
      break;

    case "terminal:input":
      console.log(`⌨️ [Client] Terminal input for ${data.sessionId}: ${JSON.stringify(data.data)}`);
      try {
        sendTerminalInput(data.sessionId, data.data);
        console.log(`✅ [Client] Terminal input sent successfully`);
      } catch (err) {
        console.error(`❌ [Client] Failed to send terminal input:`, err);
      }
      break;

    case "terminal:resize":
      console.log(`📐 [Client] Resizing terminal ${data.sessionId}: ${data.cols}x${data.rows}`);
      resizeTerminalSession(data.sessionId, data.cols, data.rows);
      break;

    case "terminal:close":
      console.log(`🔚 [Client] Closing terminal session: ${data.sessionId}`);
      closeTerminalSession(data.sessionId);
      break;

    // File system operations
    case "files:list":
      console.log(`📂 [Client] Listing directory: ${data.path || '/'}`);
      handleFilesList(data.path || '');
      break;

    case "files:read":
      console.log(`📄 [Client] Reading file: ${data.path}`);
      handleFileRead(data.path);
      break;

    case "files:mkdir":
      console.log(`📁 [Client] Creating directory: ${data.path}`);
      handleMkdir(data.path);
      break;

    case "files:delete":
      console.log(`🗑️ [Client] Deleting: ${data.path}`);
      handleFileDelete(data.path);
      break;

    case "files:rename":
      console.log(`✏️ [Client] Renaming: ${data.oldPath} -> ${data.newPath}`);
      handleFileRename(data.oldPath, data.newPath);
      break;

    case "files:write":
      console.log(`💾 [Client] Writing file: ${data.path}`);
      handleFileWrite(data.path, data.content);
      break;

    case "files:drives":
      console.log(`💿 [Client] Getting available drives`);
      handleGetDrives();
      break;

    default:
      console.log(`[Client] Получено сообщение типа '${type}':`, data);
  }
}

/**
 * Выполняет команду в shell и отправляет результат на сервер
 */
function executeCommand(command: string, execId?: string) {
  console.log(`▶️ [Client] Выполняю команду: ${command}`);
  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd.exe" : "/bin/bash";
  const shellArgs = isWindows ? ["/c", command] : ["-c", command];

  try {
    const proc = Bun.spawn([shell, ...shellArgs], {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Генерируем идентификатор выполнения и сохраняем процесс
    if (!execId) {
      execId = crypto.randomUUID();
    }

    runningCommands.set(execId, { proc, command });

    // Сообщаем серверу, что команда стартовала
    sendMessage({ type: 'status', data: { execId, status: 'started', command } });

    // Потоковая отправка stdout
    proc.stdout.pipeTo(
      new WritableStream({
        write(chunk) {
          try {
            const text = new TextDecoder().decode(chunk);
            sendMessage({ type: 'stdout', execId, chunk: text });
          } catch (e) {
            // не фатальная ошибка при отправке чанка
          }
        },
      })
    );

    // Потоковая отправка stderr
    proc.stderr.pipeTo(
      new WritableStream({
        write(chunk) {
          try {
            const text = new TextDecoder().decode(chunk);
            sendMessage({ type: 'stderr', execId, chunk: text });
          } catch (e) {
            // игнорируем
          }
        },
      })
    );

    // Ожидаем завершения процесса
    proc.exited.then((exitCode) => {
      // Отправляем финальный результат
      sendMessage({
        type: 'result',
        execId,
        command,
        exitCode,
      });

      runningCommands.delete(execId as string);
      console.log(`✨ [Client] Команда ${execId} завершена с кодом ${exitCode}`);
    });
  } catch (err) {
    console.error('[Client] Ошибка выполнения команды:', err);
    sendMessage({
      type: 'error',
      message: `Ошибка выполнения команды: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/**
 * Прерывает запущенную команду по execId
 */
function killCommand(execId: string) {
  const entry = runningCommands.get(execId);
  if (!entry) {
    // Подтверждение неуспешного kill (ack)
    sendMessage({ type: 'ack', action: 'kill', execId, success: false, message: `Команда ${execId} не найдена или уже завершена` });
    return;
  }

  try {
    const proc = entry.proc;
    if (proc && typeof proc.kill === 'function') {
      proc.kill();
    } else if (proc && proc.pid) {
      try {
        process.kill(proc.pid as number);
      } catch (e) {
        // ignore
      }
    }

    runningCommands.delete(execId);
    // Подтверждение успешного kill (ack)
    sendMessage({ type: 'ack', action: 'kill', execId, success: true, message: 'killed' });
    console.log(`🛑 [Client] Команда ${execId} была прервана`);
  } catch (err) {
    console.error('[Client] Ошибка при попытке kill:', err);
    sendMessage({ type: 'ack', action: 'kill', execId, success: false, message: `Не удалось убить команду ${execId}` });
  }
}

/**
 * Отправляет сообщение на сервер
 */
function sendMessage(message: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error("[Client] WebSocket не подключён");
    return;
  }

  try {
    // Log terminal:output messages specifically
    if (message.type === 'terminal:output') {
      console.log(`📤 [Client] Sending terminal:output to server: ${message.data?.length || 0} bytes`);
    }
    ws.send(JSON.stringify(message));
  } catch (err) {
    console.error("[Client] Ошибка отправки сообщения:", err);
  }
}

/**
 * Планирует переподключение с экспоненциальной задержкой
 */
function scheduleReconnect() {
  if (MAX_RECONNECT_ATTEMPTS !== -1 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("❌ [Client] Достигнут максимум попыток переподключения");
    process.exit(1);
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), 30000);

  console.log(`⏳ [Client] Переподключение через ${Math.round(delay / 1000)} сек (попытка ${reconnectAttempts})...`);
  reconnectTimer = setTimeout(connect, delay);
}

/**
 * Отправляет периодический статус на сервер
 */
function sendStatusPeriodically() {
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: "status",
        data: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
        },
      });
    }
  }, 60000); // каждые 60 сек
}

/**
 * File system operation handlers
 */

/**
 * List files in directory
 */
async function handleFilesList(pathStr: string) {
  try {
    // Resolve path - if empty, use home directory or root
    const targetPath = pathStr ? resolve(pathStr) : (process.env.HOME || process.env.USERPROFILE || '/');
    
    console.log(`📂 [Client] Resolved path: ${targetPath}`);

    // Check if path exists
    if (!existsSync(targetPath)) {
      sendMessage({
        type: 'files:error',
        error: `Path does not exist: ${targetPath}`
      });
      return;
    }

    // Check if it's a directory
    const stats = await stat(targetPath);
    if (!stats.isDirectory()) {
      sendMessage({
        type: 'files:error',
        error: `Path is not a directory: ${targetPath}`
      });
      return;
    }

    // Read directory contents
    const entries = await readdir(targetPath, { withFileTypes: true });
    
    // Build file list with details
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(targetPath, entry.name);
        try {
          // For symlinks, resolve to real path
          let pathToStat = fullPath;
          if (entry.isSymbolicLink()) {
            try {
              pathToStat = await realpath(fullPath);
            } catch (err) {
              // If realpath fails, skip this entry (broken symlink)
              console.warn(`[Client] Broken symlink: ${fullPath}`);
              return null;
            }
          }
          
          const stats = await stat(pathToStat);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          };
        } catch (err) {
          // If stat fails, return basic info
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: 0,
            modified: new Date(),
            created: new Date()
          };
        }
      })
    );

    // Filter out null entries (broken symlinks)
    const validFiles = files.filter(f => f !== null);

    // Send response
    sendMessage({
      type: 'files:list',
      path: targetPath,
      files: validFiles
    });

    console.log(`✅ [Client] Listed ${files.length} items in ${targetPath}`);
  } catch (err) {
    console.error('[Client] Error listing files:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to list directory: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Read file content
 */
async function handleFileRead(pathStr: string) {
  try {
    const targetPath = resolve(pathStr);
    
    console.log(`📄 [Client] Reading file: ${targetPath}`);

    // Check if file exists
    if (!existsSync(targetPath)) {
      sendMessage({
        type: 'files:error',
        error: `File does not exist: ${targetPath}`
      });
      return;
    }

    // Check if it's a file
    const stats = await stat(targetPath);
    if (!stats.isFile()) {
      sendMessage({
        type: 'files:error',
        error: `Path is not a file: ${targetPath}`
      });
      return;
    }

    // Limit file size for preview (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (stats.size > maxSize) {
      sendMessage({
        type: 'files:error',
        error: `File too large for preview (${Math.round(stats.size / 1024 / 1024)}MB > 10MB)`
      });
      return;
    }

    // Read file content
    const content = await readFile(targetPath, 'utf-8');

    // Send response
    sendMessage({
      type: 'files:content',
      path: targetPath,
      content: content,
      encoding: 'utf-8',
      size: stats.size
    });

    console.log(`✅ [Client] Read file ${targetPath} (${stats.size} bytes)`);
  } catch (err) {
    console.error('[Client] Error reading file:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Create directory
 */
async function handleMkdir(pathStr: string) {
  try {
    const targetPath = resolve(pathStr);
    
    console.log(`📁 [Client] Creating directory: ${targetPath}`);

    // Create directory (recursive by default)
    await mkdir(targetPath, { recursive: true });

    // Send response
    sendMessage({
      type: 'files:created',
      path: targetPath,
      isDirectory: true
    });

    console.log(`✅ [Client] Created directory: ${targetPath}`);
  } catch (err) {
    console.error('[Client] Error creating directory:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to create directory: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Delete file or directory
 */
async function handleFileDelete(pathStr: string) {
  try {
    const targetPath = resolve(pathStr);
    
    console.log(`🗑️ [Client] Deleting: ${targetPath}`);

    // Check if exists
    if (!existsSync(targetPath)) {
      sendMessage({
        type: 'files:error',
        error: `Path does not exist: ${targetPath}`
      });
      return;
    }

    // Check if it's a directory or file
    const stats = statSync(targetPath);
    
    if (stats.isDirectory()) {
      // Remove directory (recursive)
      await rmdir(targetPath, { recursive: true } as any);
    } else {
      // Remove file
      await unlink(targetPath);
    }

    // Send response
    sendMessage({
      type: 'files:deleted',
      path: targetPath,
      isDirectory: stats.isDirectory()
    });

    console.log(`✅ [Client] Deleted: ${targetPath}`);
  } catch (err) {
    console.error('[Client] Error deleting:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to delete: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Rename/move file or directory
 */
async function handleFileRename(oldPathStr: string, newPathStr: string) {
  try {
    const oldPath = resolve(oldPathStr);
    const newPath = resolve(newPathStr);
    
    console.log(`✏️ [Client] Renaming: ${oldPath} -> ${newPath}`);

    // Check if source exists
    if (!existsSync(oldPath)) {
      sendMessage({
        type: 'files:error',
        error: `Source path does not exist: ${oldPath}`
      });
      return;
    }

    // Check if destination already exists
    if (existsSync(newPath)) {
      sendMessage({
        type: 'files:error',
        error: `Destination already exists: ${newPath}`
      });
      return;
    }

    // Rename/move
    await rename(oldPath, newPath);

    // Send response
    sendMessage({
      type: 'files:renamed',
      oldPath: oldPath,
      newPath: newPath
    });

    console.log(`✅ [Client] Renamed: ${oldPath} -> ${newPath}`);
  } catch (err) {
    console.error('[Client] Error renaming:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to rename: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Write content to a file
 */
async function handleFileWrite(pathStr: string, content: string) {
  try {
    const targetPath = resolve(pathStr);
    
    console.log(`💾 [Client] Writing to: ${targetPath}`);

    // Write file
    await writeFile(targetPath, content, 'utf8');

    // Send response
    sendMessage({
      type: 'files:written',
      path: targetPath
    });

    console.log(`✅ [Client] File written: ${targetPath}`);
  } catch (err) {
    console.error('[Client] Error writing file:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

/**
 * Get available drives on Windows
 */
async function handleGetDrives() {
  try {
    const drives: string[] = [];
    
    // Check platform
    if (process.platform === 'win32') {
      // On Windows, check drives from C to Z
      for (let i = 67; i <= 90; i++) { // ASCII codes for C-Z
        const drive = String.fromCharCode(i) + ':\\';
        try {
          await stat(drive);
          drives.push(drive);
        } catch {
          // Drive doesn't exist, skip
        }
      }
    } else {
      // On Unix-like systems, just return root
      drives.push('/');
    }

    // Send response
    sendMessage({
      type: 'files:drives',
      drives: drives
    });

    console.log(`✅ [Client] Found drives: ${drives.join(', ')}`);
  } catch (err) {
    console.error('[Client] Error getting drives:', err);
    sendMessage({
      type: 'files:error',
      error: `Failed to get drives: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}

async function firstLaunchSetup() {
  const binBun = process.execPath;

  const ps = Bun.spawn([binBun, 'FirstLaunchSetup.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
    windowsHide: true,
    detached: true,
  });

  if (ps.exitCode !== 0) {
    console.error(`❌ [Client] First launch setup failed with exit code ${ps.exitCode}`);
  }
  
  if (ps.pid) {
    ps.unref();
    console.log(`🚀 [Client] First launch setup started (PID: ${ps.pid})`);
  }
}

// Запускаем клиент
console.log("🚀 [Client] Запускаю WebSocket клиент...");
connect();
sendStatusPeriodically();


// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[client] Получен SIGINT → выходим");
  // Прерываем все запущенные команды
  for (const execId of runningCommands.keys()) {
    try {
      const entry = runningCommands.get(execId);
      if (entry) {
        if (entry.proc && typeof entry.proc.kill === 'function') entry.proc.kill();
        else if (entry.proc && entry.proc.pid) process.kill(entry.proc.pid as number);
      }
    } catch (e) {
      // ignore
    }
  }
  ws?.close();
  process.exit(0);
});