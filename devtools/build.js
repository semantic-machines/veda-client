#!/usr/bin/env node

/**
 * Build script for Veda Client DevTools
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { BUILD_CONFIGS, STATIC_FILES, PATHS } from './build.config.js';

console.log('🔨 Building Veda Client DevTools...\n');

try {
  // Create dist directory
  if (!fs.existsSync(PATHS.dist)) {
    fs.mkdirSync(PATHS.dist, { recursive: true });
  }

  // Build all bundles
  await Promise.all([
    esbuild.build({ ...BUILD_CONFIGS.hook, logLevel: 'warning' }),
    esbuild.build({ ...BUILD_CONFIGS.background, logLevel: 'warning' }),
    esbuild.build({ ...BUILD_CONFIGS.panel, logLevel: 'info' })
  ]);

  // Copy static files
  for (const file of STATIC_FILES) {
    const srcPath = path.join(PATHS.devtools, file.from);
    const distPath = path.join(PATHS.dist, file.to);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, distPath);
    }
  }

  console.log('\n✨ Build complete!\n');
  console.log('DevTools is ready to use. Load the extension from:');
  console.log(`  ${PATHS.dist}\n`);
} catch (error) {
  console.error('✗ Build failed:', error);
  process.exit(1);
}
