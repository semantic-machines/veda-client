import {copy} from 'esbuild-plugin-copy';

export const buildOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  entryPoints: ['./src/js/index.js'],
  outfile: '../dist/examples/index.js',
  plugins: [
    copy({
      assets: [
        {
          from: ['./src/*.html'],
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
