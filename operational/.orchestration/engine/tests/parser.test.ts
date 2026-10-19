/**
 * The workflow parser against the repo's own workflow definitions
 * (operational/.orchestration/workflows): they load and validate, and their
 * step dependencies resolve into parallel batches.
 *
 * Known defect, recorded rather than fixed here: the parser's regexes and
 * template syntax are shell-escaped (\\d, \\s, \\${...} in src/parser.ts), so
 * timeouts never parse, ${...} templates are never substituted and conditions
 * never match. The it.fails cases below state what the parser should do; they
 * pass while it does not, and fail once it is fixed, when the marker must go.
 * Fixing it starts real calls to /actions URLs that no domain serves yet, so
 * it belongs with the orchestration work (#14, "Noticed, not fixed").
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  WorkflowParseError,
  buildExecutionOrder,
  evaluateCondition,
  loadWorkflowsFromDirectory,
  parseTimeout,
  parseWorkflowFile,
  resolveInputVariables,
} from '../src/parser.js';

const WORKFLOWS = fileURLToPath(new URL('../../workflows', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'workflow-engine-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe("the repo's workflow definitions", () => {
  it('load and validate, keyed by id', () => {
    const workflows = loadWorkflowsFromDirectory(WORKFLOWS);
    expect([...workflows.keys()].sort()).toEqual(['breach-response', 'entity-onboarding']);
    const onboarding = workflows.get('entity-onboarding');
    expect(onboarding?.trigger).toMatchObject({
      type: 'event',
      source: 'entity-governance.entity.created',
    });
    expect(onboarding?.steps.find((s) => s.id === 'create-standard-contracts')).toMatchObject({
      domain: 'contracts-legal',
      retries: 3,
      onFailure: 'stop',
    });
  });

  it('run entity onboarding in three batches, the middle three in parallel', () => {
    const onboarding = parseWorkflowFile(join(WORKFLOWS, 'entity-onboarding.yaml'));
    expect(buildExecutionOrder(onboarding.steps)).toEqual([
      ['create-standard-contracts'],
      ['assess-insurance-requirements', 'initiate-privacy-assessment', 'create-ip-assignments'],
      ['notify-completion'],
    ]);
  });

  it('run breach response with its notification after both checks', () => {
    const breach = parseWorkflowFile(join(WORKFLOWS, 'breach-response.yaml'));
    const order = buildExecutionOrder(breach.steps);
    expect(order.at(-1)).toEqual(['log-response-initiated']);
    expect(order[0]).toEqual(
      expect.arrayContaining(['check-contract-obligations', 'evaluate-cyber-coverage'])
    );
  });
});

describe('parser errors', () => {
  it('names the file and the invalid fields of a workflow without a trigger', () => {
    const path = join(scratch, 'no-trigger.yaml');
    writeFileSync(path, 'id: broken\nname: Broken\nsteps: []\n');
    expect(() => parseWorkflowFile(path)).toThrow(WorkflowParseError);
    expect(() => parseWorkflowFile(path)).toThrow(
      `Failed to parse workflow at ${path}: trigger: Required`
    );
  });

  it('wraps unreadable YAML in a WorkflowParseError', () => {
    const path = join(scratch, 'bad.yaml');
    writeFileSync(path, 'id: [unclosed\n');
    expect(() => parseWorkflowFile(path)).toThrow(WorkflowParseError);
  });

  it('skips an invalid file when loading a directory', () => {
    const dir = mkdtempSync(join(scratch, 'dir-'));
    writeFileSync(join(dir, 'bad.yml'), 'id: broken\n');
    writeFileSync(
      join(dir, 'ok.yaml'),
      'id: ok\nname: OK\ntrigger:\n  type: manual\nsteps:\n  - id: a\n    name: A\n    domain: d\n    action: x\n'
    );
    writeFileSync(join(dir, 'notes.txt'), 'not a workflow');
    expect([...loadWorkflowsFromDirectory(dir).keys()]).toEqual(['ok']);
  });

  it('reports a dependency cycle with the steps it could not order', () => {
    const step = (id: string, dependsOn: string[]) => ({
      id,
      name: id,
      domain: 'd',
      action: 'x',
      dependsOn,
    });
    expect(() =>
      buildExecutionOrder([step('start', []), step('a', ['b']), step('b', ['a'])])
    ).toThrow('Circular dependency detected. Remaining: a, b');
  });
});

describe('templates, conditions and timeouts (known defect: these should pass)', () => {
  it.fails("parses entity onboarding's 30s step timeout", () => {
    expect(parseTimeout('30s')).toBe(30_000);
  });

  it.fails('substitutes ${input.entityId} in step input', () => {
    const resolved = resolveInputVariables(
      { entityId: '${input.entityId}' },
      {
        input: { entityId: 'e-1' },
        workflow: { completedSteps: [], skippedSteps: [], failedSteps: [] },
        stepResults: new Map(),
      }
    );
    expect(resolved).toEqual({ entityId: 'e-1' });
  });

  it.fails("skips the IP step for an entity type outside the onboarding condition's list", () => {
    const condition = "${input.entityType in ['corporation', 'llc']}";
    expect(
      evaluateCondition(condition, { input: { entityType: 'partnership' }, workflow: {} })
    ).toBe(false);
  });

  it('meanwhile rejects every timeout it is given', () => {
    expect(() => parseTimeout('30s')).toThrow('Invalid timeout format: 30s');
  });
});
