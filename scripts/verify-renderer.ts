import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const bundlePath = join(root, 'dist', 'renderer.js');

let failed = false;

function fail(message: string): void {
  console.error(`verify:renderer: ${message}`);
  failed = true;
}

let bundle: string;
try {
  bundle = readFileSync(bundlePath, 'utf8');
} catch {
  fail(`missing bundle at ${bundlePath} — run pnpm build first`);
  process.exit(1);
}

if (bundle.includes('react/jsx-runtime')) {
  fail('dist/renderer.js imports react/jsx-runtime — use --jsx-import-source=@harborclient/sdk');
}

if (/from ['"]react['"]/.test(bundle)) {
  fail('dist/renderer.js imports from "react" — use @harborclient/sdk/react instead');
}

if (/from ['"]react-dom['"]/.test(bundle)) {
  fail('dist/renderer.js imports from "react-dom" — do not bundle react-dom in plugins');
}

if (failed) {
  process.exit(1);
}

console.log('verify:renderer: OK');
