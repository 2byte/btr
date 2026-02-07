import { RemoteServer } from './RemoteServer';
import type { MessageType, IncomingMessage, OutgoingMessage, ClientData } from './RemoteServer';

// Экспортируем для использования в других модулях
export { RemoteServer, MessageType, IncomingMessage, OutgoingMessage, ClientData };

/**
 * Инициализирует и запускает RemoteServer
 */
function initializeServer() {
  const PORT = parseInt(process.env.REMOTE_SERVER_PORT || '8080', 10);
  const HOSTNAME = process.env.REMOTE_SERVER_HOST || '0.0.0.0';

  const server = new RemoteServer(PORT, HOSTNAME);

  /**
   * Регистрируем пользовательского обработчика для результатов команд
   */
  server.on('result', (ws, msg) => {
    console.log(`✅ [RemoteServer] Результат от ${ws.data?.clientId}:`);
    console.log(`   Команда: ${msg.command}`);
    console.log(`   Exit Code: ${msg.exitCode}`);
    if (msg.stdout) console.log(`   Stdout: ${msg.stdout}`);
    if (msg.stderr) console.log(`   Stderr: ${msg.stderr}`);

    // Здесь можно добавить логику сохранения результатов, отправки в БД и т.д.
  });

  /**
   * Обработчик ошибок от клиента
   */
  server.on('error', (ws, msg) => {
    console.error(`❌ [RemoteServer] Ошибка от ${ws.data?.clientId}: ${msg.message}`);
  });

  /**
   * Обработчик статуса от клиента
   */
  server.on('status', (ws, msg) => {
    console.log(`📊 [RemoteServer] Статус от ${ws.data?.clientId}:`, msg.data);
  });

  // Запускаем сервер
  server.start();

  /**
   * Периодическая проверка здоровья (health check) каждые 30 сек
   */
  setInterval(() => {
    server.healthCheck();
  }, 30000);

  /**
   * Пример: отправляем тестовую команду первому клиенту через 10 сек после старта
   */
  setTimeout(() => {
    const clients = server.getClients();
    if (clients.length > 0) {
      const testCommand = process.platform === 'win32' ? 'echo Test' : 'echo Test';
      server.sendCommandToClient(clients[0].clientId, testCommand);
    }
  }, 10000);

  // Обработчики выхода
  process.on('SIGINT', () => {
    console.log('\n⚠️ Получен сигнал SIGINT, останавливаю сервер...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n⚠️ Получен сигнал SIGTERM, останавливаю сервер...');
    server.stop();
    process.exit(0);
  });

  return server;
}

/**
 * Запускаем сервер, если файл запущен напрямую
 */
if (import.meta.main) {
  initializeServer();
}