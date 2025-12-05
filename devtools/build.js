#!/usr/bin/env node

/**
 * Build script for Veda Client DevTools
 * Bundles both hook.js and panel.js using esbuild
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const DEVTOOLS_DIR = path.join(ROOT_DIR, 'devtools');

console.log('🔨 Building Veda Client DevTools...\n');

try {
  // Build hook.js (injected into page)
  await esbuild.build({
    entryPoints: [path.join(DEVTOOLS_DIR, 'src/hook-entry.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(DEVTOOLS_DIR, 'src/hook.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,  // No sourcemap for injected code
    minify: false,
    logLevel: 'warning'
  });

  // Bundle panel.js with all dependencies
  await esbuild.build({
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

  console.log('\n✨ Build complete!\n');
  console.log('DevTools is ready to use. Load the extension from:');
  console.log(`  ${DEVTOOLS_DIR}\n`);
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
