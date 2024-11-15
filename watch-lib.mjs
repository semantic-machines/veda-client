import * as esbuild from 'esbuild';
import options from './options-lib.mjs';

const context = await esbuild.context(options);
await context.watch();
