import * as esbuild from 'esbuild';
import {imperativeOptions, declarativeOptions} from './options.mjs';
import fs from 'fs';
import path from 'path';

async function buildAll() {
  console.log('🔨 Building TodoMVC implementations...\n');

  // Build imperative version
  console.log('📦 Building imperative version...');
  await esbuild.build(imperativeOptions);
  console.log('✅ Imperative built: dist/app-todo/index-imperative.js\n');

  // Build declarative version
  console.log('📦 Building declarative version...');
  await esbuild.build(declarativeOptions);
  console.log('✅ Declarative built: dist/app-todo/index-declarative.js\n');

  // Build test page
  console.log('📦 Building test-template-syntax...');

  // Create test directory
  const testDir = path.resolve('../dist/test');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Build JS
  await esbuild.build({
    entryPoints: ['../test-template-syntax.js'],
    bundle: true,
    format: 'esm',
    outfile: '../dist/test/test-template-syntax.js',
    sourcemap: true
  });

  // Copy HTML
  fs.copyFileSync(
    path.resolve('../test-template-syntax.html'),
    path.resolve('../dist/test/test-template-syntax.html')
  );

  console.log('✅ Test page built: dist/test/test-template-syntax.js');
  console.log('✅ Test HTML copied: dist/test/test-template-syntax.html\n');

  console.log('🎉 All builds completed!\n');
  console.log('📍 Access via:');
  console.log('   http://localhost:8888/dist/app-todo/ - Main page');
  console.log('   http://localhost:8888/dist/test/test-template-syntax.html - Test page');
}

buildAll().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
