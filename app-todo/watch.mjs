import * as esbuild from 'esbuild';

const buildConfig = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  entryPoints: ['src/js/index.js'],
  outfile: '../dist/app-todo/index.js',
};

async function watch() {
  console.log('👀 Watching TodoMVC...\n');

  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();

  console.log('✅ Watching for changes in src/js/**');
  console.log('\nPress Ctrl+C to stop\n');
}

watch().catch(err => {
  console.error('❌ Watch failed:', err);
  process.exit(1);
});
