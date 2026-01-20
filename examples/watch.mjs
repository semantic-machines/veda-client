import * as esbuild from 'esbuild';

const buildConfig = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  entryPoints: ['src/js/index.js'],
  outfile: '../dist/examples/index.js',
};

async function watch() {
  console.log('👀 Watching Examples...\n');

  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();

  console.log('✅ Watching for changes in src/**');
  console.log('\nPress Ctrl+C to stop\n');
}

watch().catch(err => {
  console.error('❌ Watch failed:', err);
  process.exit(1);
});
