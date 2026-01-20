import {copy} from 'esbuild-plugin-copy';

// Build configuration for TodoMVC
export const buildOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  minify: true,
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  entryPoints: ['./src/js/index.js'],
  outfile: '../dist/app-todo/index.js',
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
          from: ['./src/css/**/*'],
          to: ['./css'],
        },
      ],
      watch: false,
    }),
  ],
};

// Backward compatibility exports
export const imperativeOptions = buildOptions;
