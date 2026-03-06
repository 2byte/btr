import { ClientCommunicator } from './ClientCommunicator';

/**
 * Simple test for ClientCommunicator
 * 
 * Usage:
 * 1. Run this file: bun run backendServer/test-communicator.ts
 * 2. In another terminal: bun run backendServer/client.ts
 * 3. Watch the magic happen!
 */

const communicator = new ClientCommunicator(8013, '0.0.0.0');

// Setup event handlers
communicator.on('client:connected', (client) => {
  console.log(`\n✅ Клиент подключен: ${client.name} (${client.clientId})`);
  
  // Automatically send a test command when client connects
  setTimeout(() => testCommand(client.clientId), 2000);
});

communicator.on('client:disconnected', (clientId) => {
  console.log(`\n❌ Клиент отключен: ${clientId}`);
});

communicator.on('command:started', (result) => {
  console.log(`\n▶️ Команда запущена: ${result.command}`);
});

communicator.on('command:stdout', (execId, chunk) => {
  process.stdout.write(chunk);
});

communicator.on('command:stderr', (execId, chunk) => {
  process.stderr.write(`\x1b[31m${chunk}\x1b[0m`);
});

communicator.on('command:completed', (result) => {
  console.log(`\n✅ Команда завершена (exit: ${result.exitCode})`);
  console.log(`   Длительность: ${result.completedAt!.getTime() - result.startedAt.getTime()}ms`);
});

communicator.on('command:error', (execId, error) => {
  console.error(`\n❌ Ошибка команды: ${error}`);
});

// Start server
communicator.start();
console.log('\n🚀 Сервер запущен. Ожидание подключения клиентов...\n');

/**
 * Test command execution
 */
async function testCommand(clientId: string) {
  console.log(`\n📤 Отправляю тестовую команду клиенту ${clientId}...`);
  
  const command = process.platform === 'win32'
    ? 'echo Test && ping -n 3 127.0.0.1 && echo Done'
    : 'echo Test && ping -c 3 127.0.0.1 && echo Done';
  
  try {
    const result = await communicator.executeCommand(clientId, command, {
      timeout: 30000
    });
    
    console.log(`\n📊 ID команды: ${result.execId}`);
    
    // Wait for completion
    const final = await communicator.waitForCompletion(result.execId);
    
    console.log(`\n🎯 Финальный результат:`);
    console.log(`   Exit code: ${final.exitCode}`);
    console.log(`   Stdout length: ${final.stdout.length} bytes`);
    console.log(`   Stderr length: ${final.stderr.length} bytes`);
    
  } catch (err) {
    console.error(`\n❌ Ошибка:`, err);
  }
}

// Status report every 30 seconds
setInterval(() => {
  const clients = communicator.getClients();
  const running = communicator.getRunningExecutions();
  
  console.log(`\n📊 Статус:`);
  console.log(`   Клиенты: ${clients.length}`);
  console.log(`   Запущено команд: ${running.length}`);
  
  if (clients.length > 0) {
    clients.forEach(c => {
      const execs = communicator.getClientExecutions(c.clientId);
      console.log(`   - ${c.name}: ${execs.length} выполнений`);
    });
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Завершение работы...');
  communicator.stop();
  process.exit(0);
});
