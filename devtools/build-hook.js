/**
 * Build script for modular hook.js
 * Combines all modules into single file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hookDir = path.join(__dirname, 'src', 'hook');
const templatePath = path.join(__dirname, 'src', 'hook-modular-template.js');
const outputPath = path.join(__dirname, 'src', 'hook.js');
const backupPath = path.join(__dirname, 'src', 'hook-monolith.js');

// Read all modules
const modules = {
  EventEmitter: fs.readFileSync(path.join(hookDir, 'EventEmitter.js'), 'utf8'),
  Timeline: fs.readFileSync(path.join(hookDir, 'Timeline.js'), 'utf8'),
  Serializer: fs.readFileSync(path.join(hookDir, 'Serializer.js'), 'utf8'),
  Profiler: fs.readFileSync(path.join(hookDir, 'Profiler.js'), 'utf8'),
  ComponentTracker: fs.readFileSync(path.join(hookDir, 'ComponentTracker.js'), 'utf8'),
  ModelTracker: fs.readFileSync(path.join(hookDir, 'ModelTracker.js'), 'utf8'),
  EffectTracker: fs.readFileSync(path.join(hookDir, 'EffectTracker.js'), 'utf8'),
  SubscriptionTracker: fs.readFileSync(path.join(hookDir, 'SubscriptionTracker.js'), 'utf8'),
  Inspector: fs.readFileSync(path.join(hookDir, 'Inspector.js'), 'utf8')
};

// Strip export statements from modules
function stripExports(code) {
  return code
    .replace(/^export\s+/gm, '')  // Remove export keyword
    .replace(/^\/\*\*[\s\S]*?\*\/\n/m, '');  // Remove JSDoc comment at top
}

// Read template
let template = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders with module code
for (const [name, code] of Object.entries(modules)) {
  const cleaned = stripExports(code);
  template = template.replace(`\${${name}}`, cleaned);
}

// Backup old hook.js
if (fs.existsSync(outputPath)) {
  console.log('📦 Backing up old hook.js to hook-monolith.js');
  fs.copyFileSync(outputPath, backupPath);
}

// Write combined file
fs.writeFileSync(outputPath, template);

console.log('✨ Built modular hook.js');
console.log(`   ${Object.keys(modules).length} modules combined`);

// Calculate sizes
const oldSize = fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0;
const newSize = fs.statSync(outputPath).size;

if (oldSize) {
  const diff = newSize - oldSize;
  const diffPercent = ((diff / oldSize) * 100).toFixed(1);
  console.log(`   Old: ${(oldSize / 1024).toFixed(1)}kb`);
  console.log(`   New: ${(newSize / 1024).toFixed(1)}kb (${diff > 0 ? '+' : ''}${diffPercent}%)`);
} else {
  console.log(`   Size: ${(newSize / 1024).toFixed(1)}kb`);
}
