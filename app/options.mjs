import {copy} from 'esbuild-plugin-copy';

const options = {
  entryPoints: ['./src/js/index.js'],
  minify: true,
  bundle: true,
  sourcemap: true,
  outdir: '../dist/app',
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
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
