import * as esbuild from 'esbuild';
import options from './options-app.mjs';

const context = await esbuild.context(options);
await context.watch();
