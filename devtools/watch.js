#!/usr/bin/env node

/**
 * Watch mode for DevTools development
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { BUILD_CONFIGS, STATIC_FILES, PATHS } from './build.config.js';

console.log('👀 Watching DevTools for changes...\n');

// Create dist directory
if (!fs.existsSync(PATHS.dist)) {
  fs.mkdirSync(PATHS.dist, { recursive: true });
}

// Create watch contexts
const contexts = await Promise.all([
  esbuild.context({ ...BUILD_CONFIGS.hook, logLevel: 'info' }),
  esbuild.context({ ...BUILD_CONFIGS.background, logLevel: 'info' }),
  esbuild.context({ ...BUILD_CONFIGS.panel, logLevel: 'info' })
]);

// Start watching
await Promise.all(contexts.map(ctx => ctx.watch()));

// Copy static files initially
for (const file of STATIC_FILES) {
  const srcPath = path.join(PATHS.devtools, file.from);
  const distPath = path.join(PATHS.dist, file.to);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, distPath);
  }
}

console.log('✨ Watching... Press Ctrl+C to stop\n');

// Keep process alive
process.stdin.resume();
