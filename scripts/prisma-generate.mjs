#!/usr/bin/env node
/**
 * prisma generate, one at a time: runs `prisma generate` (plus any arguments
 * given) for the package in the current directory while holding a lock file
 * that every other run of this script in the checkout waits for.
 *
 *   "db:generate": "CHECKPOINT_DISABLE=1 node ../../scripts/prisma-generate.mjs"
 *
 * contracts-legal and data-privacy generate their clients before build,
 * typecheck, lint, lint:fix and dev, and turbo runs those tasks of both
 * packages in parallel. Both use the one prisma CLI in node_modules/.pnpm.
 * When that CLI's copy of the query-engine library is missing, as after an
 * install served from pnpm's side-effects cache, generate puts one there, from
 * Prisma's engine cache or by download. On darwin, Prisma 5.22 does that by
 * deleting the file and copying it again (elsewhere it renames a finished copy
 * into place), so a generate running at the same time can fail with ENOENT.
 *
 * The lock holds its owner's process id. A lock whose process has exited, such
 * as a generate that was killed, is taken over: one waiter at a time, under a
 * second lock file, re-reads the lock and removes it only if that process is
 * still its owner, so two waiters that saw the same exited owner cannot both
 * take its place. A run killed in the middle of a takeover, or before it wrote
 * its id, leaves a file that makes later runs wait; when their patience runs
 * out they name both files.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = join(root, 'node_modules', '.prisma-generate.lock');
const takeover = `${lock}.takeover`;
const patienceSeconds = 300;

function fail(message) {
  console.error(`prisma-generate: ${message}`);
  process.exit(1);
}

// The process id in the lock: null when there is no lock, NaN while its owner
// is still writing it.
function owner() {
  try {
    return Number.parseInt(readFileSync(lock, 'utf8'), 10);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function exited(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

// Removes the lock of process pid, which has exited, unless another waiter is
// taking a lock over. Without the takeover file, two waiters could both read
// pid, and the second could remove the lock the first had just created in its
// place. With it, a waiter that read pid before an earlier takeover finds the
// lock gone or held by a live process, and leaves it. False when the takeover
// file was already there.
function takeOver(pid) {
  try {
    writeFileSync(takeover, String(process.pid), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    fail(`cannot create ${takeover}: ${error.message}`);
  }
  try {
    if (owner() === pid && exited(pid)) rmSync(lock, { force: true });
  } finally {
    rmSync(takeover, { force: true });
  }
  return true;
}

async function acquire() {
  const deadline = Date.now() + patienceSeconds * 1000;
  for (;;) {
    try {
      writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') fail(`cannot create ${lock}: ${error.message}`);
    }
    const pid = owner();
    if (pid === null) continue;
    if (pid > 0 && exited(pid) && takeOver(pid)) continue;
    if (Date.now() > deadline) {
      const holder = Number.isNaN(pid) ? 'a process that never wrote its id' : `process ${pid}`;
      fail(
        `${lock} is still held by ${holder} after ${patienceSeconds} s; ` +
          `if no prisma generate is running, remove it and ${takeover}`
      );
    }
    await sleep(100);
  }
}

await acquire();
let result;
try {
  result = spawnSync('prisma', ['generate', ...process.argv.slice(2)], { stdio: 'inherit' });
} finally {
  if (owner() === process.pid) rmSync(lock, { force: true });
}
if (result.error) fail(`cannot run prisma: ${result.error.message}`);
process.exit(result.status ?? 1);
