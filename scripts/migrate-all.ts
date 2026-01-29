#!/usr/bin/env tsx
/**
 * Database Migration Coordinator
 * Runs migrations across all services in dependency order
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface ServiceConfig {
  name: string;
  path: string;
  dependencies: string[];
}

// Service dependency order
const services: ServiceConfig[] = [
  // Shared schemas first (no dependencies)
  { name: 'shared-outbox', path: 'shared/libs/outbox', dependencies: [] },
  { name: 'shared-saga', path: 'shared/libs/saga', dependencies: ['shared-outbox'] },

  // Foundational services (in dependency order)
  { name: 'entity-governance', path: 'foundational/entity-governance', dependencies: ['shared-outbox', 'shared-saga'] },
  { name: 'kyc-identity', path: 'foundational/kyc-identity', dependencies: ['entity-governance'] },
  { name: 'accounting', path: 'foundational/accounting', dependencies: ['entity-governance'] },
  { name: 'banking-treasury', path: 'foundational/banking-treasury', dependencies: ['entity-governance', 'accounting'] },
  { name: 'tax', path: 'foundational/tax', dependencies: ['entity-governance', 'accounting'] },
  { name: 'compliance', path: 'foundational/compliance', dependencies: ['entity-governance'] },
  { name: 'corporate-security', path: 'foundational/corporate-security', dependencies: ['entity-governance'] },

  // Operational services
  { name: 'contracts-legal', path: 'operational/contracts-legal', dependencies: ['entity-governance'] },
  { name: 'data-privacy', path: 'operational/data-privacy', dependencies: ['entity-governance', 'kyc-identity'] },
  { name: 'intellectual-property', path: 'operational/intellectual-property', dependencies: ['entity-governance'] },
  { name: 'insurance', path: 'operational/insurance', dependencies: ['entity-governance', 'contracts-legal'] },
];

async function runMigration(service: ServiceConfig, rootDir: string): Promise<boolean> {
  const servicePath = path.join(rootDir, service.path);
  const migrationsPath = path.join(servicePath, 'migrations');

  // Check if service has migrations
  if (!fs.existsSync(migrationsPath) && !fs.existsSync(path.join(servicePath, 'drizzle.config.ts'))) {
    console.log(`  [SKIP] ${service.name} - no migrations`);
    return true;
  }

  try {
    console.log(`  [RUN]  ${service.name}...`);
    execSync('pnpm db:migrate', {
      cwd: servicePath,
      stdio: 'pipe',
      env: { ...process.env },
    });
    console.log(`  [OK]   ${service.name}`);
    return true;
  } catch (error: any) {
    console.error(`  [FAIL] ${service.name}: ${error.message}`);
    return false;
  }
}

function topologicalSort(services: ServiceConfig[]): ServiceConfig[] {
  const sorted: ServiceConfig[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(service: ServiceConfig) {
    if (temp.has(service.name)) {
      throw new Error(`Circular dependency detected: ${service.name}`);
    }
    if (visited.has(service.name)) return;

    temp.add(service.name);

    for (const dep of service.dependencies) {
      const depService = services.find(s => s.name === dep);
      if (depService) visit(depService);
    }

    temp.delete(service.name);
    visited.add(service.name);
    sorted.push(service);
  }

  for (const service of services) {
    if (!visited.has(service.name)) {
      visit(service);
    }
  }

  return sorted;
}

async function main() {
  const rootDir = process.cwd();
  const command = process.argv[2] || 'migrate';

  console.log('Database Migration Coordinator');
  console.log('==============================');
  console.log(`Root: ${rootDir}`);
  console.log(`Command: ${command}`);
  console.log('');

  // Sort services by dependency order
  const sortedServices = topologicalSort(services);

  if (command === 'migrate') {
    console.log('Running migrations in order:');
    console.log('');

    let failed = 0;
    for (const service of sortedServices) {
      const success = await runMigration(service, rootDir);
      if (!success) failed++;
    }

    console.log('');
    if (failed > 0) {
      console.log(`Completed with ${failed} failures`);
      process.exit(1);
    } else {
      console.log('All migrations completed successfully');
    }
  } else if (command === 'status') {
    console.log('Migration order:');
    sortedServices.forEach((s, i) => {
      const deps = s.dependencies.length > 0 ? ` (depends on: ${s.dependencies.join(', ')})` : '';
      console.log(`  ${i + 1}. ${s.name}${deps}`);
    });
  } else if (command === 'generate') {
    console.log('Generating migrations for all services...');
    for (const service of sortedServices) {
      const servicePath = path.join(rootDir, service.path);
      if (fs.existsSync(path.join(servicePath, 'drizzle.config.ts'))) {
        try {
          console.log(`  Generating: ${service.name}`);
          execSync('pnpm db:generate', { cwd: servicePath, stdio: 'inherit' });
        } catch {
          // Continue on error
        }
      }
    }
  } else {
    console.log('Usage: migrate-all.ts [migrate|status|generate]');
    process.exit(1);
  }
}

main().catch(console.error);
