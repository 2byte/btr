#!/usr/bin/env bun
/**
 * Token Generator Utility
 * 
 * Generates secure API tokens for RemoteServer authentication
 * 
 * Usage:
 *   bun generate-token.ts              # Generate one token
 *   bun generate-token.ts --count 5    # Generate 5 tokens
 *   bun generate-token.ts --length 64  # Generate 64-character token
 */

import { AuthManager } from './AuthManager';

interface GenerateOptions {
  count: number;
  length: number;
  format: 'simple' | 'secure';
}

/**
 * Parse command line arguments
 */
function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2);
  const options: GenerateOptions = {
    count: 1,
    length: 32,
    format: 'secure',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--count':
      case '-c':
        options.count = parseInt(args[++i], 10) || 1;
        break;
      
      case '--length':
      case '-l':
        options.length = parseInt(args[++i], 10) || 32;
        break;
      
      case '--simple':
      case '-s':
        options.format = 'simple';
        break;
      
      case '--secure':
        options.format = 'secure';
        break;
      
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      
      default:
        console.error(`Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Token Generator for RemoteServer Authentication

Usage:
  bun generate-token.ts [options]

Options:
  -c, --count <n>      Generate N tokens (default: 1)
  -l, --length <n>     Token length (default: 32)
  -s, --simple         Use simple random generation (alphanumeric)
  --secure             Use crypto secure generation (default, hex)
  -h, --help           Show this help message

Examples:
  bun generate-token.ts
    Generate one secure token (32 bytes hex)
  
  bun generate-token.ts --count 5
    Generate 5 secure tokens
  
  bun generate-token.ts --length 64 --simple
    Generate a 64-character simple alphanumeric token
  
  bun generate-token.ts -c 3 -l 16
    Generate 3 secure tokens (16 bytes hex)

Output:
  Tokens will be printed to stdout, one per line.
  You can add them to your .env file:
  
  API_TOKENS=token1,token2,token3
`);
}

/**
 * Generate tokens
 */
function generateTokens(options: GenerateOptions): string[] {
  const tokens: string[] = [];
  
  for (let i = 0; i < options.count; i++) {
    const token = options.format === 'secure'
      ? AuthManager.generateSecureToken(options.length)
      : AuthManager.generateToken(options.length);
    
    tokens.push(token);
  }
  
  return tokens;
}

/**
 * Main function
 */
function main(): void {
  const options = parseArgs();
  
  console.log(`\n🔑 Generating ${options.count} token(s)...\n`);
  
  const tokens = generateTokens(options);
  
  // Print tokens
  tokens.forEach((token, index) => {
    console.log(`Token ${index + 1}: ${token}`);
  });
  
  // Print usage instructions
  console.log(`\n📝 Usage:\n`);
  console.log(`Add to your .env file:\n`);
  
  if (tokens.length === 1) {
    console.log(`API_TOKEN=${tokens[0]}`);
  } else {
    console.log(`API_TOKENS=${tokens.join(',')}`);
  }
  
  console.log(`\nServer configuration:\n`);
  console.log(`const communicator = new ClientCommunicator({`);
  console.log(`  port: 8080,`);
  console.log(`  hostname: '0.0.0.0',`);
  console.log(`  authConfig: {`);
  console.log(`    required: true,`);
  if (tokens.length === 1) {
    console.log(`    tokens: ['${tokens[0]}']`);
  } else {
    console.log(`    tokens: [`);
    tokens.forEach(t => console.log(`      '${t}',`));
    console.log(`    ]`);
  }
  console.log(`  }`);
  console.log(`});\n`);
  
  console.log(`Client usage:\n`);
  console.log(`API_TOKEN=${tokens[0]} bun client.ts\n`);
}

// Run
main();
