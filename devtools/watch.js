#!/usr/bin/env node

/**
 * Watch mode for DevTools development
 * Automatically rebuilds on file changes
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEVTOOLS_DIR = __dirname;
const SRC_DIR = path.join(DEVTOOLS_DIR, 'src');
const DIST_DIR = path.join(DEVTOOLS_DIR, 'dist');

console.log('👀 Watching DevTools for changes...\n');

// Create dist directory
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Build hook.js context
const hookContext = await esbuild.context({
  entryPoints: [path.join(SRC_DIR, 'hook/index.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(DIST_DIR, 'hook.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

// Build background.js context
const backgroundContext = await esbuild.context({
  entryPoints: [path.join(SRC_DIR, 'background.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(DIST_DIR, 'background.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: false,
  logLevel: 'info'
});

// Build panel.js context
const panelContext = await esbuild.context({
  entryPoints: [path.join(SRC_DIR, 'panel/index.js')],
  bundle: true,
  format: 'iife',
  outfile: path.join(DIST_DIR, 'panel.js'),
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  logLevel: 'info'
});

// Watch all
await Promise.all([
  hookContext.watch(),
  backgroundContext.watch(),
  panelContext.watch()
]);

// Copy static files on start
const filesToCopy = [
  { from: 'src/content-script.js', to: 'content-script.js' },
  { from: 'src/devtools-page.js', to: 'devtools.js' },
  { from: 'src/panel/panel.html', to: 'panel.html' },
  { from: 'devtools.html', to: 'devtools.html' },
  { from: 'manifest.json', to: 'manifest.json' }
];

for (const file of filesToCopy) {
  const srcPath = path.join(DEVTOOLS_DIR, file.from);
  const distPath = path.join(DIST_DIR, file.to);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, distPath);
  }
}

console.log('✨ Watching... Press Ctrl+C to stop\n');

// Keep process alive
process.stdin.resume();
