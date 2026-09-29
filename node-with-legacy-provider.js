#!/usr/bin/env node
/**
 * Wrapper script to enable OpenSSL legacy provider for Redsys DES encryption support
 * This is required because Redsys uses DES encryption which is deprecated in OpenSSL 3.x
 */

const { execSync } = require('child_process');

// Enable legacy OpenSSL provider for DES support
process.env.NODE_OPTIONS = '--openssl-legacy-provider';

// Get the command from arguments (e.g., 'next', 'next build', etc.)
const args = process.argv.slice(2);
const command = args.join(' ');

if (!command) {
  console.error('Usage: node-with-legacy-provider.js <command>');
  process.exit(1);
}

try {
  // Execute the command with the environment variable set
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}
