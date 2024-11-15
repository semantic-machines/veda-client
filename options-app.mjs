import {copy} from 'esbuild-plugin-copy';
import path from 'node:path';
import fs from 'node:fs';

const htmlMin = {
  name: 'html',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, 'utf8');
      const contents = source.replace(/html`(.*?)`/gs, (_, group) => {
        group = group.replace(/\s+/g, ' ').replace(/\s</g, '<').replace(/<!--.*?-->/g, '').trimEnd();
        return 'html`' + group + '`';
      });
      return {contents};
    });
  },
};

const options = {
  entryPoints: ['./app/js/index.js'],
  minify: true,
  bundle: true,
  sourcemap: true,
  outdir: 'dist/app',
  platform: 'browser',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  plugins: [
    // htmlMin,
    copy({
      assets: {
        from: ['./app/ontology/**/*'],
        to: ['../ontology'],
      },
      verbose: true,
      watch: true,
    }),
    copy({
      assets: {
        from: ['./app/*'],
        to: ['./'],
      },
      watch: true,
    }),
  ],
};

export default options;
