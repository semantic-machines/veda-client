import {copy} from 'esbuild-plugin-copy';

const options = {
  entryPoints: ['./src/js/index.js'],
  minify: true,
  bundle: true,
  sourcemap: true,
  outdir: '../dist/app-react',
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  loader: { '.js': 'jsx' },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  plugins: [
    copy({
      assets: {
        from: ['./src/ontology/**/*'],
        to: ['../ontology'],
      },
      verbose: true,
      watch: true,
    }),
    copy({
      assets: {
        from: ['./src/*'],
        to: ['./'],
      },
      watch: true,
    }),
  ],
};

export default options;
