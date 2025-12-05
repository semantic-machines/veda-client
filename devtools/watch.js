#!/usr/bin/env node

/**
 * Watch mode for DevTools development
 * Automatically rebuilds on file changes
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DEVTOOLS_DIR = path.join(ROOT_DIR, 'devtools');

console.log('👀 Watching DevTools for changes...\n');

// Build hook.js context
const hookContext = await esbuild.context({
  entryPoints: [path.join(DEVTOOLS_DIR, 'src/hook-entry.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(DEVTOOLS_DIR, 'src/hook.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

// Build panel.js context
const panelContext = await esbuild.context({
  entryPoints: [path.join(DEVTOOLS_DIR, 'panel/panel-source.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(DEVTOOLS_DIR, 'panel/panel.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  logLevel: 'info'
});

// Watch both
await Promise.all([
  hookContext.watch(),
  panelContext.watch()
]);

console.log('✨ Watching... Press Ctrl+C to stop\n');

// Keep process alive
process.stdin.resume();

