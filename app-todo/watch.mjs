import * as esbuild from 'esbuild';

const buildConfig = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
};

async function watchAll() {
  console.log('👀 Watching TodoMVC implementations...\n');

  // Watch imperative version
  const imperativeCtx = await esbuild.context({
    ...buildConfig,
    entryPoints: ['src/js/index.js'],
    outfile: '../dist/todo/index.js',
  });

  // Watch declarative version
  const declarativeCtx = await esbuild.context({
    ...buildConfig,
    entryPoints: ['src-declarative/js/index.js'],
    outfile: '../dist/todo-declarative/index.js',
  });

  await imperativeCtx.watch();
  await declarativeCtx.watch();

  console.log('✅ Watching for changes...');
  console.log('   - Imperative: src/js/**');
  console.log('   - Declarative: src-declarative/js/**');
  console.log('\nPress Ctrl+C to stop\n');
}

watchAll().catch(err => {
  console.error('❌ Watch failed:', err);
  process.exit(1);
});
