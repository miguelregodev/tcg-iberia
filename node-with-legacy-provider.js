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

if (args[0] === 'next' && args[1] === 'dev') {
  const portFlag = args.findIndex((arg) => arg === '--port' || arg === '-p');
  const port = portFlag >= 0
    ? args[portFlag + 1]
    : args.find((arg) => arg.startsWith('--port='))?.split('=')[1] || process.env.PORT || '3000';
  if (!/^\d+$/.test(port || '') || Number(port) < 1 || Number(port) > 65535) {
    console.error('Development port must be between 1 and 65535.');
    process.exit(1);
  }
  // Separate dev servers must not overwrite each other's manifests and chunks.
  process.env.NEXT_DEV_DIST_DIR = `.next/dev-${Number(port)}`;
} else {
  delete process.env.NEXT_DEV_DIST_DIR;
}

try {
  // Execute the command with the environment variable set
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(error.status || 1);
}
