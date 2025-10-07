import {copy} from 'esbuild-plugin-copy';

const options = {
  entryPoints: ['./src/js/index.js'],
  minify: true,
  bundle: true,
  sourcemap: true,
  outdir: '../dist/todo',
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  plugins: [
    copy({
      assets: {
        from: ['./node_modules/todomvc-common/base.css'],
        to: ['./css'],
      },
      watch: true,
    }),
    copy({
      assets: {
        from: ['./node_modules/todomvc-app-css/index.css'],
        to: ['./css/todomvc-app.css'],
      },
      watch: true,
    }),
    copy({
      assets: {
        from: ['./src/*'],
        to: ['./'],
      },
      watch: true,
    }),
    copy({
      assets: {
        from: ['./src/ontology/**/*'],
        to: ['../ontology'],
      },
      watch: true,
    }),
  ],
};

export default options;


