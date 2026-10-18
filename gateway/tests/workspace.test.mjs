import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('pnpm discovers the HTTP gateway separately from the operational aggregator', () => {
  // Metadata discovery only: no install, application import, server or provider call.
  const packages = JSON.parse(
    execFileSync('pnpm', ['list', '--recursive', '--depth=-1', '--json'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, COREPACK_ENABLE_NETWORK: '0' },
    })
  );
  const pathsFor = (name) =>
    packages
      .filter((entry) => entry.name === name)
      .map((entry) => relative(root, entry.path).split('\\').join('/'));

  assert.deepEqual(pathsFor('@ecosystem/gateway'), ['gateway']);
  assert.deepEqual(pathsFor('@ecosystem/operational-gateway'), ['operational/gateway']);
});

test('the gateway exposes its metadata regression to the workspace test runner', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'gateway/package.json'), 'utf8'));
  assert.equal(manifest.scripts.test, 'node --test tests/*.test.mjs');
});

test('the focused GitHub workflow invokes the gateway regressions explicitly', () => {
  const workflow = resolve(root, '.github/workflows/workspace-wiring.yml');
  assert.ok(existsSync(workflow), 'workspace wiring needs a CI entrypoint');
  assert.match(
    readFileSync(workflow, 'utf8'),
    /run: pnpm --filter @ecosystem\/gateway run test\s*$/m
  );
});
