import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DIST = join(ROOT, 'dist', 'skill-browser.html');

export default async function globalSetup() {
  // Build catalog if data.js is missing
  if (!existsSync(join(ROOT, 'data.js'))) {
    console.log('[e2e setup] Running build.mjs...');
    const build = spawnSync(process.execPath, [join(ROOT, 'build.mjs')], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (build.status !== 0) throw new Error('build.mjs failed');
  }

  // Always (re)bundle so dist reflects current index.html + hash-router.js
  console.log('[e2e setup] Running bundle.mjs...');
  const bundle = spawnSync(process.execPath, [join(ROOT, 'bundle.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (bundle.status !== 0) throw new Error('bundle.mjs failed');

  if (!existsSync(DIST)) throw new Error(`dist not found after bundle: ${DIST}`);
  console.log(`[e2e setup] Bundle ready: ${DIST}`);
}
