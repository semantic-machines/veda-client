import * as esbuild from 'esbuild';
import {imperativeOptions, declarativeOptions} from './options.mjs';

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

  console.log('🎉 All builds completed!\n');
  console.log('📍 Access via:');
  console.log('   http://localhost:8080/dist/app-todo/ - Main page');
}

buildAll().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
