import { createInterface } from 'node:readline/promises';
import { ClientInstallerBuilder } from '../ClientInstallerBuilder.ts';
import { MorphShift } from '../utils/MorphShift.ts';

async function cli(): Promise<void> {
const rl = createInterface({
    input:  process.stdin,
    output: process.stdout,
});

console.log('=== BTR Client Installer Builder ===');
console.log('');
console.log('1. Build client_install.vbs');
console.log('2. Encode variables only');
console.log('');

const choice = (await rl.question('Select option: ')).trim();

switch (choice) {
    case '1': {
        const wsUrl      = await rl.question('WS_URL      (e.g. ws://127.0.0.1:8080):    ');
        const apiToken   = await rl.question('API_TOKEN   (e.g. my-secret-token):         ');
        const clientName = await rl.question('CLIENT_NAME (e.g. office-pc, leave empty):  ');

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
        break;
    }

    case '2': {
        const wsUrl      = await rl.question('WS_URL      (e.g. ws://127.0.0.1:8080):    ');
        const apiToken   = await rl.question('API_TOKEN   (e.g. my-secret-token):         ');
        const clientName = await rl.question('CLIENT_NAME (e.g. office-pc, leave empty):  ');

        rl.close();

        const morph = new MorphShift(3);

        console.log('');
        console.log('Encoded values (MorphShift shift=3):');
        console.log(`  WS_URL      = ${morph.to(wsUrl.trim())}`);
        console.log(`  API_TOKEN   = ${morph.to(apiToken.trim())}`);
        console.log(`  CLIENT_NAME = ${morph.to(clientName.trim())}`);
        break;
    }

    default:
        rl.close();
        console.error(`Unknown option: ${choice}`);
        process.exit(1);
}

}

if (import.meta.main) {
    cli().catch(err => {
        console.error('An error occurred:', err);
        process.exit(1);
    });
}

export default cli;
