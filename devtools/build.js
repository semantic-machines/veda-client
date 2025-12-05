#!/usr/bin/env node

/**
 * Build script for Veda Client DevTools
 * Bundles hook, panel, and copies static files using esbuild
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

console.log('🔨 Building Veda Client DevTools...\n');

try {
  // Create dist directory
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Build hook.js (injected into page)
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'hook/index.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(DIST_DIR, 'hook.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: false,
    logLevel: 'warning'
  });

  // Build background.js (service worker)
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'background.js')],
    bundle: true,
    format: 'esm',
    outfile: path.join(DIST_DIR, 'background.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: false,
    logLevel: 'warning'
  });

  // Build panel.js
  await esbuild.build({
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

  // Copy static files
  const filesToCopy = [
    { from: 'src/content-script.js', to: 'content-script.js' },
    { from: 'src/devtools-page.js', to: 'devtools.js' },
    { from: 'src/panel/panel.html', to: 'panel.html' },
    { from: 'src/devtools.html', to: 'devtools.html' },
    { from: 'src/manifest.json', to: 'manifest.json' }
  ];

  for (const file of filesToCopy) {
    const srcPath = path.join(DEVTOOLS_DIR, file.from);
    const distPath = path.join(DIST_DIR, file.to);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, distPath);
    }
  }

  console.log('\n✨ Build complete!\n');
  console.log('DevTools is ready to use. Load the extension from:');
  console.log(`  ${DIST_DIR}\n`);
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
