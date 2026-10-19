/**
 * The CLI as the end-to-end test drives it: the built dist/cli.js in a child
 * Node process, under the network guard (turbo builds before it tests).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = new URL('../dist/cli.js', import.meta.url).pathname;
const GUARD = new URL('./no-network.mjs', import.meta.url).href;
const FIXTURE = new URL('../fixtures/synthetic-sales-2026-09-10.json', import.meta.url).pathname;

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'commerce-intake-cli-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function intake(
  args: string[],
  env: Record<string, string> = {}
): { status: number | null; stdout: string; stderr: string } {
  const { SOURCE_DATE_EPOCH: _ignored, ...inherited } = process.env;
  return spawnSync(process.execPath, ['--import', GUARD, CLI, ...args], {
    encoding: 'utf8',
    env: { ...inherited, ...env },
    timeout: 30_000,
  });
}

describe('commerce-intake import', () => {
  it('prints one JSON result, then skips everything on a second run', () => {
    const spool = join(directory, 'events.ndjson');
    const first = intake(['import', '--fixture', FIXTURE, '--spool', spool], {
      SOURCE_DATE_EPOCH: '1792324800',
    });
    expect(first.stderr).toBe('');
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({
      schema: 'commerce-intake-import/1',
      spool,
      events: 7,
      appended: 7,
      skipped: 0,
    });
    const bytes = readFileSync(spool);
    // A later run with another clock changes only metadata, which is not content.
    const second = intake(['import', '--fixture', FIXTURE, '--spool', spool]);
    expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({ appended: 0, skipped: 7 });
    expect(readFileSync(spool).equals(bytes)).toBe(true);
  });

  it('exits 2 on a conflicting duplicate, prints nothing on stdout and writes nothing', () => {
    const spool = join(directory, 'events.ndjson');
    expect(intake(['import', '--fixture', FIXTURE, '--spool', spool]).status).toBe(0);
    const before = readFileSync(spool);
    const file = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
      records: { lines: { net: number }[] }[];
    };
    (file.records[0]?.lines[0] as { net: number }).net += 1;
    const changed = join(directory, 'changed.json');
    writeFileSync(changed, JSON.stringify(file));
    const result = intake(['import', '--fixture', changed, '--spool', spool]);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toStrictEqual({
      error: 'conflicting duplicate event_id',
      event_id: '862e33fe-05d3-5e1d-be92-b15dffb5ddbd',
    });
    expect(readFileSync(spool).equals(before)).toBe(true);
  });

  it.each([
    ['no command', ['--fixture', FIXTURE, '--spool', 'events.ndjson'], /usage/],
    ['an unknown command', ['export', '--fixture', FIXTURE, '--spool', 'events.ndjson'], /usage/],
    ['no spool', ['import', '--fixture', FIXTURE], /usage/],
    [
      'an unknown option',
      ['import', '--fixture', FIXTURE, '--spool', 'events.ndjson', '--live'],
      /usage/,
    ],
    [
      'a missing fixture',
      ['import', '--fixture', 'missing.json', '--spool', 'events.ndjson'],
      /ENOENT/,
    ],
  ])('exits 2 with %s', (_case, args, message) => {
    const result = intake(
      args.map((arg) => (arg === 'events.ndjson' ? join(directory, arg) : arg))
    );
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect((JSON.parse(result.stderr) as { error: string }).error).toMatch(message);
    expect(existsSync(join(directory, 'events.ndjson'))).toBe(false);
  });

  it('exits 2 on a bad SOURCE_DATE_EPOCH', () => {
    const spool = join(directory, 'events.ndjson');
    const result = intake(['import', '--fixture', FIXTURE, '--spool', spool], {
      SOURCE_DATE_EPOCH: 'yesterday',
    });
    expect(result.status).toBe(2);
    expect(existsSync(spool)).toBe(false);
  });

  it('runs its child processes under the network guard', () => {
    const probe = spawnSync(
      process.execPath,
      ['--import', GUARD, '-e', "require('node:net').connect(9, '127.0.0.1')"],
      {
        encoding: 'utf8',
      }
    );
    expect(probe.status).not.toBe(0);
    expect(probe.stderr).toMatch(/network access refused/);
  });
});
