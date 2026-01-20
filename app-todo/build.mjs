import * as esbuild from 'esbuild';
import {buildOptions} from './options.mjs';

async function build() {
  console.log('🔨 Building TodoMVC...\n');

  await esbuild.build(buildOptions);
  console.log('✅ Built: dist/app-todo/index.js\n');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
