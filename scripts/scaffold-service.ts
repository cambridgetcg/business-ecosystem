#!/usr/bin/env tsx
/**
 * Service Scaffold Generator
 * 
 * Usage:
 *   pnpm scaffold:service <service-path> [--domain <domain-name>]
 * 
 * Example:
 *   pnpm scaffold:service operational/contracts-legal --domain contracts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const TEMPLATE_DIR = join(__dirname, 'templates/service');

interface ScaffoldOptions {
  servicePath: string;
  serviceName: string;
  domainResource?: string;
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function processTemplate(content: string, options: ScaffoldOptions): string {
  return content
    .replace(/\{\{SERVICE_NAME\}\}/g, options.serviceName)
    .replace(/\{\{SERVICE_PATH\}\}/g, options.servicePath)
    .replace(/\{\{DOMAIN_RESOURCE\}\}/g, options.domainResource || 'resource')
    .replace(/\{\{domainResource\}\}/g, toCamelCase(options.domainResource || 'resource'));
}

function copyTemplateDir(srcDir: string, destDir: string, options: ScaffoldOptions): void {
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const entries = readdirSync(srcDir);

  for (const entry of entries) {
    const srcPath = join(srcDir, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      const destSubDir = join(destDir, entry);
      copyTemplateDir(srcPath, destSubDir, options);
    } else if (entry.endsWith('.template')) {
      const destFileName = entry.replace('.template', '');
      const destPath = join(destDir, destFileName);
      
      // Skip if file already exists
      if (existsSync(destPath)) {
        console.log(`  Skipping (exists): ${destPath}`);
        continue;
      }

      const content = readFileSync(srcPath, 'utf-8');
      const processed = processTemplate(content, options);
      writeFileSync(destPath, processed, 'utf-8');
      console.log(`  Created: ${destPath}`);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: scaffold-service.ts <service-path> [--domain <domain-name>]');
    console.error('Example: scaffold-service.ts operational/contracts-legal --domain contracts');
    process.exit(1);
  }

  const servicePath = args[0];
  const domainIndex = args.indexOf('--domain');
  const domainResource = domainIndex !== -1 ? args[domainIndex + 1] : undefined;

  const serviceName = basename(servicePath);
  const fullServicePath = join(ROOT_DIR, servicePath);

  const options: ScaffoldOptions = {
    servicePath,
    serviceName,
    domainResource,
  };

  console.log(`\nScaffolding service: ${serviceName}`);
  console.log(`  Path: ${fullServicePath}`);
  console.log(`  Domain: ${domainResource || '(none specified)'}\n`);

  // Create service directory if it doesn't exist
  if (!existsSync(fullServicePath)) {
    mkdirSync(fullServicePath, { recursive: true });
  }

  // Copy template files
  copyTemplateDir(TEMPLATE_DIR, fullServicePath, options);

  console.log('\nScaffolding complete!');
  console.log('\nNext steps:');
  console.log(`  1. cd ${servicePath}`);
  console.log('  2. Create prisma/schema.prisma for your domain models');
  console.log('  3. Implement domain entities in src/domain/');
  console.log('  4. Add commands and queries in src/application/');
  console.log('  5. Create API routes in src/api/rest/');
  console.log('  6. Run: pnpm install && pnpm dev');
}

main();
