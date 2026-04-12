import { createInterface } from 'node:readline/promises';
import { ClientInstallerBuilder } from './ClientInstallerBuilder';

const rl = createInterface({
    input:  process.stdin,
    output: process.stdout,
});

console.log('=== BTR Client Installer Builder ===');
console.log('');
console.log('Builds client_install.vbs with encoded WS_URL and API_TOKEN baked in.');
console.log('');

const wsUrl      = await rl.question('WS_URL      (e.g. ws://127.0.0.1:8080):   ');
const apiToken   = await rl.question('API_TOKEN   (e.g. my-secret-token):        ');
const clientName = await rl.question('CLIENT_NAME (e.g. office-pc, leave empty): ');

rl.close();

if (!wsUrl.trim()) {
    console.error('ERROR: WS_URL cannot be empty.');
    process.exit(1);
}

const result = ClientInstallerBuilder.createVbsInstaller().build({
    wsUrl:      wsUrl.trim(),
    apiToken:   apiToken.trim(),
    clientName: clientName.trim(),
});

console.log('');
console.log('Build complete:');
console.log(`  VBS  -> ${result.vbsPath}`);
console.log(`  Meta -> ${result.metaPath}`);

