import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Turbo schedules the HTTP gateway build after its declared workspace dependencies', () => {
  const cache = mkdtempSync(join(tmpdir(), 'gateway-build-plan-'));
  try {
    const plan = JSON.parse(
      execFileSync(
        'pnpm',
        [
          'exec',
          'turbo',
          'run',
          'build',
          '--filter=@ecosystem/gateway',
          '--dry-run=json',
          `--cache-dir=${cache}`,
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            COREPACK_ENABLE_NETWORK: '0',
            TURBO_TELEMETRY_DISABLED: '1',
            DO_NOT_TRACK: '1',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )
    );
    const manifest = JSON.parse(readFileSync(join(root, 'gateway/package.json'), 'utf8'));
    const tasks = plan.tasks.filter((task) => task.taskId === '@ecosystem/gateway#build');
    assert.equal(tasks.length, 1, 'the edge gateway must not silently disappear from builds');
    assert.equal(tasks[0].directory, 'gateway');
    assert.equal(tasks[0].command, manifest.scripts.build);
    const dependencies = Object.entries(manifest.dependencies)
      .filter(([, version]) => version.startsWith('workspace:'))
      .map(([name]) => `${name}#build`)
      .sort();
    assert.deepEqual([...tasks[0].dependencies].sort(), dependencies);
    for (const dependency of dependencies) {
      assert.ok(
        plan.tasks.some((task) => task.taskId === dependency),
        dependency
      );
    }
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});
