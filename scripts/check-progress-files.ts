#!/usr/bin/env tsx
/**
 * Progress Files Checker
 *
 * Validates that all apps have required progress tracking files
 * and that the files are properly formatted.
 *
 * Usage: pnpm progress:check
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LAYERS = ['foundational', 'operational', 'gateway'];

interface ValidationResult {
  app: string;
  path: string;
  hasStatus: boolean;
  statusValid: boolean;
  hasPath: boolean;
  hasLight: boolean;
  issues: string[];
}

/**
 * Validate STATUS.md format
 */
function validateStatusFile(filePath: string): { valid: boolean; issues: string[] } {
  if (!existsSync(filePath)) {
    return { valid: false, issues: ['STATUS.md not found'] };
  }

  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];

  // Check required sections
  const requiredPatterns = [
    { pattern: /\*\*Layer\*\*:/, name: 'Layer field' },
    { pattern: /\*\*Status\*\*:/, name: 'Status field' },
    { pattern: /## At a Glance/, name: 'At a Glance section' },
    { pattern: /Overall Progress/, name: 'Overall Progress metric' },
    { pattern: /Current Waypoint/, name: 'Current Waypoint metric' },
    { pattern: /## Progress Breakdown/, name: 'Progress Breakdown section' },
    { pattern: /## Current Focus/, name: 'Current Focus section' },
    { pattern: /## Next Steps/, name: 'Next Steps section' },
  ];

  for (const { pattern, name } of requiredPatterns) {
    if (!pattern.test(content)) {
      issues.push(`Missing: ${name}`);
    }
  }

  // Validate status value
  const statusMatch = content.match(/\*\*Status\*\*:\s*(Ready|Active|Skeleton|Placeholder)/i);
  if (!statusMatch) {
    issues.push('Invalid status value (must be Ready, Active, Skeleton, or Placeholder)');
  }

  // Validate progress percentage
  const progressMatch = content.match(/Overall Progress\s*\|\s*(\d+)%/);
  if (!progressMatch) {
    issues.push('Missing or invalid progress percentage');
  } else {
    const progress = parseInt(progressMatch[1], 10);
    if (progress < 0 || progress > 100) {
      issues.push(`Invalid progress percentage: ${progress}%`);
    }
  }

  // Check last updated date
  const dateMatch = content.match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    issues.push('Missing or invalid Last Updated date (format: YYYY-MM-DD)');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Discover and validate all apps
 */
function validateAllApps(): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const layer of LAYERS) {
    const layerPath = join(ROOT_DIR, layer);
    if (!existsSync(layerPath)) continue;

    const entries = readdirSync(layerPath);
    for (const entry of entries) {
      const appPath = join(layerPath, entry);
      if (!statSync(appPath).isDirectory()) continue;
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      if (entry === 'research' || entry === 'shared') continue;

      const statusPath = join(appPath, 'STATUS.md');
      const pathPath = join(appPath, 'PATH.md');
      const lightPath = join(appPath, 'LIGHT.md');

      const statusValidation = validateStatusFile(statusPath);

      results.push({
        app: entry,
        path: `${layer}/${entry}`,
        hasStatus: existsSync(statusPath),
        statusValid: statusValidation.valid,
        hasPath: existsSync(pathPath),
        hasLight: existsSync(lightPath),
        issues: statusValidation.issues,
      });
    }
  }

  return results;
}

/**
 * Main function
 */
function main() {
  console.log('Checking progress files...\n');

  const results = validateAllApps();
  let hasErrors = false;

  // Group by status
  const valid: ValidationResult[] = [];
  const invalid: ValidationResult[] = [];
  const missing: ValidationResult[] = [];

  for (const result of results) {
    if (!result.hasStatus) {
      missing.push(result);
    } else if (!result.statusValid) {
      invalid.push(result);
    } else {
      valid.push(result);
    }
  }

  // Report valid apps
  if (valid.length > 0) {
    console.log(`✓ ${valid.length} apps with valid STATUS.md:`);
    for (const r of valid) {
      const extras = [];
      if (r.hasPath) extras.push('PATH');
      if (r.hasLight) extras.push('LIGHT');
      const extraStr = extras.length > 0 ? ` [+${extras.join(', ')}]` : '';
      console.log(`  ✓ ${r.path}${extraStr}`);
    }
    console.log();
  }

  // Report invalid apps
  if (invalid.length > 0) {
    hasErrors = true;
    console.log(`✗ ${invalid.length} apps with invalid STATUS.md:`);
    for (const r of invalid) {
      console.log(`  ✗ ${r.path}`);
      for (const issue of r.issues) {
        console.log(`    - ${issue}`);
      }
    }
    console.log();
  }

  // Report missing apps
  if (missing.length > 0) {
    hasErrors = true;
    console.log(`! ${missing.length} apps missing STATUS.md:`);
    for (const r of missing) {
      console.log(`  ! ${r.path}`);
    }
    console.log();
  }

  // Summary
  console.log('Summary:');
  console.log(`  Total apps: ${results.length}`);
  console.log(`  Valid STATUS.md: ${valid.length}`);
  console.log(`  Invalid STATUS.md: ${invalid.length}`);
  console.log(`  Missing STATUS.md: ${missing.length}`);
  console.log(`  Apps with PATH.md: ${results.filter(r => r.hasPath).length}`);
  console.log(`  Apps with LIGHT.md: ${results.filter(r => r.hasLight).length}`);

  if (hasErrors) {
    console.log('\n✗ Validation failed');
    process.exit(1);
  } else {
    console.log('\n✓ All progress files valid');
    process.exit(0);
  }
}

main();
