import {copy} from 'esbuild-plugin-copy';

// Common build configuration
const commonOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  minify: true,
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
};

// Imperative version (Loop-based)
export const imperativeOptions = {
  ...commonOptions,
  entryPoints: ['./src/js/index.js'],
  outfile: '../dist/app-todo/index-imperative.js',
  plugins: [
    copy({
      assets: [
        {
          from: ['./src/ontology/**/*'],
          to: ['../ontology'],
        },
        {
          from: ['./src/*.html'],
          to: ['./'],
        },
        {
          from: ['./src/favicon.ico'],
          to: ['./'],
        },
        {
          from: ['./node_modules/todomvc-app-css/index.css'],
          to: ['./css/base.css'],
        },
      ],
      watch: false,
    }),
  ],
};

// Declarative version (property/rel-based)
export const declarativeOptions = {
  ...commonOptions,
  entryPoints: ['./src-declarative/js/index.js'],
  outfile: '../dist/app-todo/index-declarative.js',
};
