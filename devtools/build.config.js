/**
 * Shared build configuration for DevTools
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PATHS = {
  devtools: __dirname,
  src: path.join(__dirname, 'src'),
  dist: path.join(__dirname, 'dist')
};

/**
 * esbuild configurations
 */
export const BUILD_CONFIGS = {
  hook: {
    entryPoints: [path.join(PATHS.src, 'hook/index.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(PATHS.dist, 'hook.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: false
  },
  
  background: {
    entryPoints: [path.join(PATHS.src, 'background.js')],
    bundle: true,
    format: 'esm',
    outfile: path.join(PATHS.dist, 'background.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: false
  },
  
  contentScript: {
    entryPoints: [path.join(PATHS.src, 'content-script.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(PATHS.dist, 'content-script.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    minify: false
  },
  
  panel: {
    entryPoints: [path.join(PATHS.src, 'panel/index.js')],
    bundle: true,
    format: 'iife',
    outfile: path.join(PATHS.dist, 'panel.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    minify: false
  }
};

/**
 * Static files to copy from src/ to dist/
 */
export const STATIC_FILES = [
  { from: 'src/devtools-page.js', to: 'devtools.js' },
  { from: 'src/panel/panel.html', to: 'panel.html' },
  { from: 'src/devtools.html', to: 'devtools.html' },
  { from: 'src/manifest.json', to: 'manifest.json' }
];

