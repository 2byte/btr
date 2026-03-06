// client.ts
// Подключаемся к RemoteServer

const WS_URL = process.env.WS_URL || "ws://127.0.0.1:8080";
const API_TOKEN = process.env.API_TOKEN || process.argv[2] || ""; // Authentication token

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

      // Представляемся серверу с токеном аутентификации
      sendMessage({
        type: "hello",
        name: `remote-${process.platform}-${crypto.randomUUID().slice(0, 6)}`,
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
      }
    };

    ws.onclose = () => {
      console.log("🔌 [Client] Соединение закрыто");
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.error("[Client] WebSocket ошибка:", err);
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