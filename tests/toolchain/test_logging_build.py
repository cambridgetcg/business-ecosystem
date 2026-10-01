"""Exercise shared-package compiler contracts using the pinned workspace tools."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class LoggingToolchainTests(unittest.TestCase):
    def test_logging_typechecks_for_nodenext_consumers(self):
        pnpm = shutil.which('pnpm')
        self.assertIsNotNone(pnpm, 'Install the packageManager version from package.json first.')
        result = subprocess.run(
            [pnpm, '--filter', '@ecosystem/logging', 'run', 'typecheck'],
            cwd=ROOT, text=True, capture_output=True, timeout=90,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_logging_build_exposes_a_typed_esm_entrypoint(self):
        pnpm = shutil.which('pnpm')
        self.assertIsNotNone(pnpm)
        result = subprocess.run(
            [pnpm, '--filter', '@ecosystem/logging', 'run', 'build'],
            cwd=ROOT, text=True, capture_output=True, timeout=90,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        package = ROOT / 'shared/libs/logging'
        self.assertTrue((package / 'dist/index.d.ts').is_file())
        probe = subprocess.run(
            ['node', '--input-type=module', '-e', '''
import assert from 'node:assert/strict';
import { createLogger, withContext, createAuditLogger, logAudit, pino } from './dist/index.js';
assert.equal(typeof pino, 'function');
const logger = createLogger({serviceName: 'toolchain-probe', prettyPrint: false});
withContext(logger, {correlationId: 'synthetic-correlation'}).info(
  {user: {password: 'synthetic-private-value'}}, 'probe');
logAudit(createAuditLogger({serviceName: 'toolchain-probe'}), {
  action: 'probe', entityType: 'synthetic', entityId: 'example',
  actorId: 'test', actorType: 'system'
});
'''], cwd=package, text=True, capture_output=True, timeout=30,
        )
        self.assertEqual(probe.returncode, 0, probe.stderr)
        import json
        messages = [json.loads(line) for line in probe.stdout.splitlines()]
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]['service'], 'toolchain-probe')
        self.assertEqual(messages[0]['correlationId'], 'synthetic-correlation')
        self.assertEqual(messages[0]['user']['password'], '[REDACTED]')
        self.assertNotIn('synthetic-private-value', probe.stdout)
        self.assertTrue(messages[1]['audit'])
        self.assertEqual(messages[1]['action'], 'probe')


if __name__ == '__main__':
    unittest.main()
