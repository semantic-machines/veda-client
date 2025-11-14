// Setup DOM environment first (before any tests)
import './setup-dom.js';

import ImportedWebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ImportedWebSocket;
}

import baretest from 'baretest';
import assert from 'assert';
import {readdir} from 'fs/promises';

const test = baretest('Tests');
const re = /^.*\.test\.js$/;

// Parse command line arguments
const args = process.argv.slice(2);
const runUnit = args.includes('--unit');
const runIntegration = args.includes('--integration');
const runAll = !runUnit && !runIntegration;

(async function () {
  let files = [];

  if (runAll || runUnit) {
    // Load unit tests from test/
    const unitFiles = (await readdir('./test'))
      .filter((f) => re.test(f))
      .map(f => './' + f);
    files.push(...unitFiles);
  }

  if (runAll || runIntegration) {
    // Load integration tests from test/integration/
    try {
      const integrationFiles = (await readdir('./test/integration'))
        .filter((f) => re.test(f))
        .map(f => './integration/' + f);
      files.push(...integrationFiles);
    } catch (e) {
      // Integration directory might not exist
    }
  }

  console.log(`\n🧪 Running ${runUnit ? 'UNIT' : runIntegration ? 'INTEGRATION' : 'ALL'} tests (${files.length} files)\n`);

  const modules = await Promise.all(files.map((file) => import(file)));
  modules.forEach((module) => {
    const t = module.default;
    t({test, assert});
  });
  assert(await test.run());
  process.exit(0);
})();
