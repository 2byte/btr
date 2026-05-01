import type { BtrServerSettings } from "../serverVideoCapture/notify/types";

export class PackageBuilder {
  protected files: string[] = [];
  protected ignores: string[] = [];
  protected envVars: Record<string, string> = {};
  protected notifyEnvVars: Record<string, string> = {};
  protected btrSettings: Partial<BtrServerSettings> = {};

  public getFiles(): string[] {
    return this.files;
  }

  public getEnvVars(): Record<string, string> {
    return this.envVars;
  }

  public getNotifyEnvVars(): Record<string, string> {
    return this.notifyEnvVars;
  }

  public getBtrSettings(): Partial<BtrServerSettings> {
    return this.btrSettings;
  }

  public getIgnores(): string[] {
    return this.ignores;
  }

  public addFile(path: string): this {
    this.files.push(path);
    return this;
  }

  public addIgnore(path: string): this {
    this.ignores.push(path);
    return this;
  }

  public setEnvVar(key: string, value: string): this {
    this.envVars[key] = value;
    return this;
  }

  public setNotifyEnvVar(key: string, value: string): this {
    this.notifyEnvVars[key] = value;
    return this;
  }

  public setBtrSetting(key: keyof BtrServerSettings, value: any): this {
    (this.btrSettings as any)[key] = value;
    return this;
  }
}
