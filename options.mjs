const options = {
  entryPoints: ['./src/index.js'],
  minify: true,
  bundle: true,
  sourcemap: true,
  outdir: 'dist',
  platform: 'node',
  mainFields: ['module', 'main'],
  logLevel: 'info',
};

export default options;
