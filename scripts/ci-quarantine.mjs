#!/usr/bin/env node
/**
 * CI quarantine: package tasks that fail today and stay out of ci.yml until
 * they are fixed. ci/quarantine.json lists them with a reason, the first
 * error, an error count and an exit criterion. The list may only shrink.
 *
 *   node scripts/ci-quarantine.mjs <lint|typecheck|build|test>
 *     Print the turbo --filter=!<package> arguments for one task:
 *     pnpm exec turbo run lint $(node scripts/ci-quarantine.mjs lint)
 *   node scripts/ci-quarantine.mjs check
 *     Validate the list against the workspace graph.
 *   node scripts/ci-quarantine.mjs report
 *     Re-measure every entry and print a Markdown table.
 *   node scripts/ci-quarantine.mjs ratchet <base-ref>
 *     Re-measure the entries of packages changed since <base-ref> (and of
 *     their dependents), and lint new .ts files in lint-quarantined packages.
 *
 * report and ratchet exit 1 when an entry now passes (remove it), its error
 * count rose, or its errors cannot be counted; ratchet also when the list
 * grew or a new file has lint errors. Both run `pnpm --filter <package> run
 * <task>` directly, so build the non-quarantined packages first.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const listPath = 'ci/quarantine.json';
const tasks = ['lint', 'typecheck', 'build', 'test'];
// Root files that can change every package's result for these tasks, but that
// turbo's change detection attributes to no package.
const rootInputs = {
  '.eslintrc.cjs': ['lint'],
  [listPath]: tasks,
  'scripts/ci-quarantine.mjs': tasks,
};
const annotate = process.env.GITHUB_ACTIONS === 'true';

function sh(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    // No colour codes, and no turbo telemetry notice in the JSON turbo prints.
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TURBO_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' },
  });
}

function fail(message) {
  console.error(`ci-quarantine: ${message}`);
  process.exit(1);
}

function flag(level, message) {
  console.log(annotate ? `::${level}::${message.replaceAll('\n', '%0A')}` : `${level}: ${message}`);
}

function turboLs(args) {
  const result = sh('pnpm', ['exec', 'turbo', 'ls', ...args, '--output=json']);
  if (result.status !== 0) fail(`turbo ls ${args.join(' ')} failed\n${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch {
    return fail(`turbo ls ${args.join(' ')} did not print JSON\n${result.stdout.slice(0, 2000)}`);
  }
}

function keyOf(entry) {
  return `${entry.package}#${entry.task}`;
}

function parseList(text, source) {
  const list = JSON.parse(text);
  if (!Array.isArray(list.entries)) fail(`${source} has no entries array`);
  return list;
}

// Validate the list; return name -> { path, scripts, dependents } for its packages.
function check(list) {
  const problems = [];
  const keys = new Set();
  for (const entry of list.entries) {
    const key = keyOf(entry);
    if (keys.has(key)) problems.push(`${key} is listed twice`);
    keys.add(key);
    if (!tasks.includes(entry.task)) problems.push(`${key}: task must be one of ${tasks.join(', ')}`);
    for (const field of ['reason', 'first_error', 'exit']) {
      if (typeof entry[field] !== 'string' || entry[field] === '') problems.push(`${key}: ${field} is required`);
    }
    if (!/^[0-9a-f]{40}$/.test(entry.measured_at ?? '')) problems.push(`${key}: measured_at must be a full commit SHA`);
    if (!Number.isInteger(entry.errors) || entry.errors < 0) problems.push(`${key}: errors must be a whole number`);
  }

  const workspace = new Set(turboLs([]).packages.items.map((item) => item.name));
  const names = [...new Set(list.entries.map((entry) => entry.package))].filter((name) => workspace.has(name));
  const packages = new Map(
    (names.length ? turboLs(names).packages : []).map((item) => [
      item.name,
      { path: item.path, scripts: item.tasks.items.map((task) => task.name), dependents: item.dependents },
    ])
  );
  for (const entry of list.entries) {
    const key = keyOf(entry);
    const info = packages.get(entry.package);
    if (!info) {
      problems.push(`${key}: no such workspace package`);
      continue;
    }
    if (!info.scripts.includes(entry.task)) problems.push(`${key}: the package has no ${entry.task} script`);
    // turbo still runs a filtered-out package's task when a dependent needs it,
    // so a library other packages depend on must be fixed, not quarantined.
    if ((entry.task === 'build' || entry.task === 'typecheck') && info.dependents.length > 0) {
      problems.push(`${key}: ${info.dependents.join(', ')} depend on it; fix it instead`);
    }
  }
  if (problems.length) fail(`${listPath} is invalid:\n  ${problems.join('\n  ')}`);
  return packages;
}

// Same-package tasks turbo runs before this one (turbo.json: test -> build).
function prerequisites(task) {
  const config = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8'));
  return (config.tasks[task]?.dependsOn ?? []).filter((dep) => !dep.startsWith('^') && !dep.includes('#'));
}

// Packages to skip for a task. A quarantined build is skipped for test too:
// turbo runs a package's build before its test, even when it has no test script.
function skipped(list, task) {
  const names = new Set(list.entries.filter((entry) => entry.task === task).map((entry) => entry.package));
  for (const before of prerequisites(task)) {
    for (const name of skipped(list, before)) names.add(name);
  }
  return names;
}

function count(task, output, passed) {
  if (task === 'lint') {
    const summary = output.match(/✖ \d+ problems? \((\d+) errors?/);
    return summary ? Number(summary[1]) : passed ? 0 : null;
  }
  if (task === 'test') {
    if (output.includes('No test files found')) return 0;
    const files = output.match(/Test Files\s+(\d+) failed/);
    return files ? Number(files[1]) : passed ? 0 : null;
  }
  const diagnostics = output.match(/error TS\d+:/g)?.length ?? 0;
  return diagnostics > 0 || passed ? diagnostics : null;
}

function firstError(task, output, directory) {
  const lines = output.split('\n');
  if (task === 'lint') {
    let file = '';
    for (const line of lines) {
      if (line.startsWith('/')) file = relative(join(root, directory), line.trim());
      const hit = line.match(/^\s+(\d+):(\d+)\s+error\s+(.+)$/);
      if (hit) return `${file}:${hit[1]}:${hit[2]} ${hit[3].replace(/\s{2,}/g, ' ').trim()}`;
    }
    return '';
  }
  const pattern = task === 'test' ? /No test files found|FAIL / : /error TS\d+:/;
  return lines.find((line) => pattern.test(line))?.trim() ?? '';
}

function measure(entry, packages) {
  const result = sh('pnpm', ['--filter', entry.package, 'run', entry.task]);
  const output = `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
  const passed = result.status === 0;
  return {
    passed,
    errors: count(entry.task, output, passed),
    first: firstError(entry.task, output, packages.get(entry.package).path),
  };
}

// One verdict per re-measured entry; `bad` ones fail report and ratchet.
function verdict(entry, now) {
  if (now.passed) return { bad: true, text: 'passes now: remove the entry' };
  if (now.errors === null) return { bad: true, text: 'fails, but its errors could not be counted' };
  if (now.errors > entry.errors) return { bad: true, text: `errors rose from ${entry.errors} to ${now.errors}` };
  if (now.errors < entry.errors) return { bad: false, text: `errors fell from ${entry.errors} to ${now.errors}: lower the count` };
  return { bad: false, text: 'unchanged' };
}

function cell(text) {
  return String(text).replaceAll('|', '\\|');
}

function report(list, packages) {
  let bad = 0;
  const head = sh('git', ['rev-parse', '--short', 'HEAD']).stdout.trim();
  const rows = list.entries.map((entry) => {
    const now = measure(entry, packages);
    const result = verdict(entry, now);
    if (result.bad) bad += 1;
    return `| ${entry.task} | ${entry.package} | ${entry.errors} | ${now.errors ?? '?'} | ${result.text} | ${cell(now.first)} |`;
  });
  const perTask = tasks.map((task) => `${task} ${list.entries.filter((entry) => entry.task === task).length}`);
  console.log(`### CI quarantine\n`);
  console.log(`\`${listPath}\` lists ${list.entries.length} entries (${perTask.join(', ')}). Re-measured at ${head}.\n`);
  console.log('| Task | Package | Recorded errors | Errors now | Result | First error now |');
  console.log('|---|---|---:|---:|---|---|');
  console.log(rows.join('\n'));
  for (const task of tasks) {
    const listed = new Set(list.entries.filter((entry) => entry.task === task).map((entry) => entry.package));
    const extra = [...skipped(list, task)].filter((name) => !listed.has(name)).sort();
    if (extra.length) {
      console.log(`\n\`${task}\` also skips ${extra.join(', ')}: their quarantined ${prerequisites(task).join(', ')} runs first.`);
    }
  }
  return bad;
}

function gitLines(args) {
  const result = sh('git', args);
  if (result.status !== 0) fail(`git ${args.join(' ')} failed\n${result.stderr}`);
  return result.stdout.split('\n').filter(Boolean);
}

function ratchet(list, packages, base) {
  if (!base) fail('ratchet needs a base ref, e.g. origin/main');
  let bad = 0;
  const range = `${base}...HEAD`;

  const before = sh('git', ['show', `${base}:${listPath}`]);
  if (before.status === 0) {
    const recorded = new Map(parseList(before.stdout, `${base}:${listPath}`).entries.map((entry) => [keyOf(entry), entry.errors]));
    for (const entry of list.entries) {
      const key = keyOf(entry);
      if (!recorded.has(key)) {
        flag('error', `${key} was added to ${listPath}; the list may only shrink`);
        bad += 1;
      } else if (entry.errors > recorded.get(key)) {
        flag('error', `${key}: the recorded errors rose from ${recorded.get(key)} to ${entry.errors}; the list may only shrink`);
        bad += 1;
      }
    }
  } else {
    console.log(`${listPath} does not exist at ${base}; skipping the growth check.`);
  }

  const touched = new Set(turboLs([`--filter=...[${base}]`]).packages.items.map((item) => item.name));
  const wide = new Set(gitLines(['diff', '--name-only', range]).flatMap((file) => rootInputs[file] ?? []));
  const due = list.entries.filter((entry) => touched.has(entry.package) || wide.has(entry.task));
  console.log(`Re-measuring ${due.length} of ${list.entries.length} entries touched since ${base}.`);
  for (const entry of due) {
    const result = verdict(entry, measure(entry, packages));
    if (result.text === 'unchanged') console.log(`${keyOf(entry)}: unchanged`);
    else flag(result.bad ? 'error' : 'notice', `${keyOf(entry)}: ${result.text}`);
    if (result.bad) bad += 1;
  }

  const lintDirectories = list.entries
    .filter((entry) => entry.task === 'lint')
    .map((entry) => `${packages.get(entry.package).path}/src/`);
  const added = gitLines(['diff', '--name-only', '--diff-filter=A', range, '--', '*.ts']);
  for (const file of added.filter((path) => lintDirectories.some((directory) => path.startsWith(directory)))) {
    const result = sh('pnpm', ['exec', 'eslint', file]);
    if (result.status !== 0) {
      flag('error', `${file} is new in a lint-quarantined package and does not lint clean\n${result.stdout}${result.stderr}`);
      bad += 1;
    }
  }
  return bad;
}

const [command, argument] = process.argv.slice(2);
const list = parseList(readFileSync(join(root, listPath), 'utf8'), listPath);
const packages = check(list);
if (tasks.includes(command)) {
  console.log([...skipped(list, command)].sort().map((name) => `--filter=!${name}`).join(' '));
} else if (command === 'check') {
  console.log(`${listPath}: ${list.entries.length} entries, valid.`);
} else if (command === 'report') {
  process.exitCode = report(list, packages) > 0 ? 1 : 0;
} else if (command === 'ratchet') {
  process.exitCode = ratchet(list, packages, argument) > 0 ? 1 : 0;
} else {
  fail(`unknown command ${command ?? '(none)'}; use ${tasks.join('|')}|check|report|ratchet <base-ref>`);
}
