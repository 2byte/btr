/**
 * Authentication manager for RemoteServer
 * Handles API token validation and management
 */

export interface AuthConfig {
  /**
   * List of valid API tokens
   */
  tokens: string[];
  
  /**
   * Whether authentication is required
   * If false, all connections are allowed
   */
  required: boolean;
  
  /**
   * Token metadata (optional)
   */
  tokenMetadata?: Map<string, TokenMetadata>;
}

export interface TokenMetadata {
  /**
   * Token name/description
   */
  name: string;
  
  /**
   * Creation date
   */
  createdAt: Date;
  
  /**
   * Expiration date (optional)
   */
  expiresAt?: Date;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Authentication manager class
 */
export class AuthManager {
  private config: AuthConfig;
  private tokenMetadata: Map<string, TokenMetadata>;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      tokens: config.tokens || [],
      required: config.required ?? true,
      tokenMetadata: config.tokenMetadata,
    };
    
    this.tokenMetadata = this.config.tokenMetadata || new Map();
  }

  /**
   * Validate an API token
   * 
   * @param token - Token to validate
   * @returns true if token is valid, false otherwise
   */
  public validateToken(token: string | undefined): boolean {
    // If auth is not required, allow all
    if (!this.config.required) {
      return true;
    }

    // If no token provided, deny
    if (!token) {
      return false;
    }

    // Check if token exists in the list
    if (!this.config.tokens.includes(token)) {
      return false;
    }

    // Check if token has metadata and is expired
    const metadata = this.tokenMetadata.get(token);
    if (metadata?.expiresAt && metadata.expiresAt < new Date()) {
      console.warn(`[AuthManager] Token expired: ${metadata.name}`);
      return false;
    }

    return true;
  }

  /**
   * Add a new token
   * 
   * @param token - Token string
   * @param metadata - Optional metadata
   */
  public addToken(token: string, metadata?: TokenMetadata): void {
    if (!this.config.tokens.includes(token)) {
      this.config.tokens.push(token);
    }

    if (metadata) {
      this.tokenMetadata.set(token, metadata);
    }
  }

  /**
   * Remove a token
   * 
   * @param token - Token to remove
   */
  public removeToken(token: string): boolean {
    const index = this.config.tokens.indexOf(token);
    if (index > -1) {
      this.config.tokens.splice(index, 1);
      this.tokenMetadata.delete(token);
      return true;
    }
    return false;
  }

  /**
   * Get token metadata
   * 
   * @param token - Token string
   * @returns Token metadata or undefined
   */
  public getTokenMetadata(token: string): TokenMetadata | undefined {
    return this.tokenMetadata.get(token);
  }

  /**
   * Get all valid tokens
   * 
   * @returns Array of valid tokens
   */
  public getTokens(): string[] {
    return [...this.config.tokens];
  }

  /**
   * Check if authentication is required
   * 
   * @returns true if auth is required
   */
  public isAuthRequired(): boolean {
    return this.config.required;
  }

  /**
   * Set whether authentication is required
   * 
   * @param required - Whether auth is required
   */
  public setAuthRequired(required: boolean): void {
    this.config.required = required;
  }

  /**
   * Get number of active tokens
   * 
   * @returns Number of tokens
   */
  public getTokenCount(): number {
    return this.config.tokens.length;
  }

  /**
   * Clear all tokens
   */
  public clearTokens(): void {
    this.config.tokens = [];
    this.tokenMetadata.clear();
  }

  /**
   * Load tokens from environment variable
   * Format: TOKEN1,TOKEN2,TOKEN3
   * 
   * @param envVar - Environment variable name (default: API_TOKENS)
   */
  public loadFromEnv(envVar: string = 'API_TOKENS'): number {
    const tokensStr = process.env[envVar];
    if (!tokensStr) {
      return 0;
    }

    const tokens = tokensStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
    let added = 0;

    for (const token of tokens) {
      if (!this.config.tokens.includes(token)) {
        this.addToken(token);
        added++;
      }
    }

    return added;
  }

  /**
   * Generate a random token
   * 
   * @param length - Token length (default: 32)
   * @returns Generated token
   */
  public static generateToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return token;
  }

  /**
   * Generate a secure token using crypto
   * 
   * @param length - Number of bytes (default: 32, will be converted to hex string)
   * @returns Generated token
   */
  public static generateSecureToken(length: number = 32): string {
    const buffer = new Uint8Array(length);
    crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
