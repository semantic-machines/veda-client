import * as esbuild from 'esbuild';
import {buildOptions} from './options.mjs';

async function build() {
  console.log('🔨 Building Examples...\n');

  await esbuild.build(buildOptions);
  console.log('✅ Built: dist/examples/\n');
}

build().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
