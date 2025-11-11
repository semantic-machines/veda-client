// Setup DOM environment first
import './setup-dom.js';

import ImportedWebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ImportedWebSocket;
}

import baretest from 'baretest';
import assert from 'assert';

// Import only component tests
import ComponentTest from './Component.test.js';
import IfComponentTest from './IfComponent.test.js';
import LoopComponentTest from './LoopComponent.test.js';
import PropertyComponentTest from './PropertyComponent.test.js';
import RelationComponentTest from './RelationComponent.test.js';
import ValueComponentTest from './ValueComponent.test.js';
import ExpressionParserTest from './ExpressionParser.test.js';

const test = baretest('Component Tests');

(async function () {
  // Run only component-related tests
  ComponentTest({ test, assert });
  IfComponentTest({ test, assert });
  LoopComponentTest({ test, assert });
  PropertyComponentTest({ test, assert });
  RelationComponentTest({ test, assert });
  ValueComponentTest({ test, assert });
  ExpressionParserTest({ test, assert });

  assert(await test.run());
  process.exit(0);
})();

