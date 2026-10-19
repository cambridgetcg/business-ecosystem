"""Build the shared libraries other packages compile against, then import their ESM output."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]

# One synthetic probe per library: it imports dist/index.js in a fresh Node
# process and calls code that needs no network, database or real credential.
# @ecosystem/outbox is absent while its build is quarantined (ci/quarantine.json).
PROBES = {
    '@ecosystem/health': ('shared/libs/health', '''
import assert from 'node:assert/strict';
import { createMemoryHealthCheck, registerHealthCheck, clearHealthChecks } from './dist/index.js';
const check = createMemoryHealthCheck(90, 'probe');
assert.equal(check.name, 'probe');
assert.equal(check.critical, false);
registerHealthCheck(check);
clearHealthChecks();
'''),
    '@ecosystem/saga': ('shared/libs/saga', '''
import assert from 'node:assert/strict';
import { registerSaga, getSagaDefinition, sagaMigrationSQL } from './dist/index.js';
registerSaga({type: 'toolchain-probe', steps: []});
assert.equal(getSagaDefinition('toolchain-probe').type, 'toolchain-probe');
assert.match(sagaMigrationSQL, /CREATE TABLE/);
'''),
    '@ecosystem/service-auth': ('shared/libs/service-auth', '''
import assert from 'node:assert/strict';
import { createServiceToken, verifyServiceToken } from './dist/index.js';
const config = {secret: 'synthetic-probe-secret', issuer: 'probe', audience: 'probe'};
const token = await createServiceToken(config, {
  serviceId: 'probe', serviceName: 'probe', permissions: ['entity:read'], environment: 'test'
});
const identity = await verifyServiceToken(config, token);
assert.equal(identity.serviceId, 'probe');
assert.deepEqual(identity.permissions, ['entity:read']);
'''),
    '@ecosystem/audit-logging': ('shared/libs/audit-logging', '''
import assert from 'node:assert/strict';
import { InMemoryAuditTrailService } from './dist/index.js';
const trail = new InMemoryAuditTrailService({serviceName: 'toolchain-probe', environment: 'test'});
await trail.log('CREATE', 'synthetic', 'example', {userId: 'probe', userEmail: undefined});
const [entry] = await trail.query({userId: 'probe'});
assert.equal(entry.resourceId, 'example');
assert.equal(entry.success, true);
'''),
    '@ecosystem/contracts-entity': ('shared/contracts/entity', '''
import assert from 'node:assert/strict';
import { corporateStructureNodeSchema } from './dist/index.js';
const leaf = {entityId: '00000000-0000-4000-8000-000000000002', name: 'Leaf', type: 'llc',
  ownershipPercentage: 100};
const root = {entityId: '00000000-0000-4000-8000-000000000001', name: 'Root', type: 'corporation',
  ownershipPercentage: 100, children: [leaf]};
assert.deepEqual(corporateStructureNodeSchema.parse(root), root);
const invalid = {...root, children: [{...leaf, ownershipPercentage: 101}]};
assert.equal(corporateStructureNodeSchema.safeParse(invalid).success, false);
'''),
    '@ecosystem/observability': ('shared/libs/observability', '''
import assert from 'node:assert/strict';
import { createRequestContext, runWithContext, getCorrelationId, SpanStatusCode } from './dist/index.js';
const ctx = createRequestContext('toolchain-probe', {correlationId: 'synthetic-correlation'});
assert.equal(runWithContext(ctx, () => getCorrelationId()), 'synthetic-correlation');
assert.equal(typeof SpanStatusCode.ERROR, 'number');
'''),
    '@ecosystem/service-client': ('shared/libs/service-client', '''
import assert from 'node:assert/strict';
import { BaseServiceClient, createServiceClients } from './dist/index.js';
const clients = createServiceClients(
  {secret: 'synthetic-probe-secret', issuer: 'probe', audience: 'probe'},
  {serviceId: 'probe', serviceName: 'probe', permissions: [], environment: 'test'},
  {accounting: 'http://127.0.0.1:9'},
);
assert.ok(clients.accounting instanceof BaseServiceClient);
'''),
}


class SharedLibraryToolchainTests(unittest.TestCase):
    def test_shared_libraries_build_and_import_under_node(self):
        pnpm = shutil.which('pnpm')
        self.assertIsNotNone(pnpm, 'Install the packageManager version from package.json first.')
        filters = [arg for name in PROBES for arg in ('--filter', f'{name}...')]
        build = subprocess.run(
            [pnpm, *filters, 'run', 'build'],
            cwd=ROOT, text=True, capture_output=True, timeout=300,
        )
        self.assertEqual(build.returncode, 0, build.stdout + build.stderr)
        for name, (directory, probe) in PROBES.items():
            with self.subTest(name):
                package = ROOT / directory
                self.assertTrue((package / 'dist/index.d.ts').is_file())
                result = subprocess.run(
                    ['node', '--input-type=module', '-e', probe],
                    cwd=package, text=True, capture_output=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
