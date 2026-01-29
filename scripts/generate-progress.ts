#!/usr/bin/env tsx
/**
 * Progress Dashboard Generator
 *
 * Scans all apps for STATUS.md files and generates:
 * - Updated PROGRESS.md dashboard
 * - Updated ECOSYSTEM-STATUS.json
 *
 * Usage: pnpm progress
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LAYERS = ['foundational', 'operational', 'gateway'];

interface AppStatus {
  name: string;
  layer: string;
  path: string;
  status: 'ready' | 'active' | 'skeleton' | 'placeholder';
  progress: number;
  currentWaypoint: string | null;
  waypointName: string | null;
  totalWaypoints: number | null;
  completedWaypoints: number | null;
  blockers: string[];
  hasLight: boolean;
  hasPath: boolean;
  hasStatus: boolean;
  techStack: string[];
  lastActivity: string;
}

interface EcosystemStatus {
  lastUpdated: string;
  version: string;
  summary: {
    totalApps: number;
    productionReady: number;
    inDevelopment: number;
    skeleton: number;
    placeholder: number;
    overallProgress: number;
  };
  layers: Record<string, { appCount: number; progress: number; apps: string[] }>;
  apps: Record<string, AppStatus>;
}

/**
 * Parse STATUS.md to extract progress information
 */
function parseStatusFile(filePath: string): Partial<AppStatus> | null {
  if (!existsSync(filePath)) return null;

  const content = readFileSync(filePath, 'utf-8');
  const result: Partial<AppStatus> = {};

  // Extract status (Ready, Active, Skeleton, Placeholder)
  const statusMatch = content.match(/\*\*Status\*\*:\s*(Ready|Active|Skeleton|Placeholder)/i);
  if (statusMatch) {
    result.status = statusMatch[1].toLowerCase() as AppStatus['status'];
  }

  // Extract overall progress percentage
  const progressMatch = content.match(/Overall Progress\s*\|\s*(\d+)%/);
  if (progressMatch) {
    result.progress = parseInt(progressMatch[1], 10) / 100;
  }

  // Extract current waypoint
  const waypointMatch = content.match(/Current Waypoint\s*\|\s*([^|]+)/);
  if (waypointMatch) {
    const wp = waypointMatch[1].trim();
    if (wp && wp !== '-' && wp !== 'Not started' && wp !== 'Maintenance') {
      result.currentWaypoint = wp.split(':')[0].trim();
      result.waypointName = wp.includes(':') ? wp.split(':')[1].trim() : wp;
    } else if (wp === 'Maintenance') {
      result.waypointName = 'Maintenance';
    }
  }

  // Extract blockers
  const blockersMatch = content.match(/Blockers\s*\|\s*([^|]+)/);
  if (blockersMatch) {
    const blockers = blockersMatch[1].trim();
    if (blockers && blockers !== 'None' && blockers !== '-') {
      result.blockers = [blockers];
    } else {
      result.blockers = [];
    }
  }

  return result;
}

/**
 * Check for presence of tracking files
 */
function checkTrackingFiles(appPath: string): { hasLight: boolean; hasPath: boolean; hasStatus: boolean } {
  return {
    hasLight: existsSync(join(appPath, 'LIGHT.md')),
    hasPath: existsSync(join(appPath, 'PATH.md')),
    hasStatus: existsSync(join(appPath, 'STATUS.md')),
  };
}

/**
 * Discover all apps in the ecosystem
 */
function discoverApps(): AppStatus[] {
  const apps: AppStatus[] = [];

  for (const layer of LAYERS) {
    const layerPath = join(ROOT_DIR, layer);
    if (!existsSync(layerPath)) continue;

    const entries = readdirSync(layerPath);
    for (const entry of entries) {
      const appPath = join(layerPath, entry);
      if (!statSync(appPath).isDirectory()) continue;
      if (entry.startsWith('.') || entry === 'node_modules') continue;

      // Skip non-app directories
      if (entry === 'research' || entry === 'shared') continue;

      const statusFile = join(appPath, 'STATUS.md');
      const parsedStatus = parseStatusFile(statusFile);
      const trackingFiles = checkTrackingFiles(appPath);

      // Determine app name from STATUS.md or directory name
      let name = entry.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (existsSync(statusFile)) {
        const content = readFileSync(statusFile, 'utf-8');
        const titleMatch = content.match(/^#\s+(.+?)\s+Status/m);
        if (titleMatch) {
          name = titleMatch[1];
        }
      }

      apps.push({
        name,
        layer,
        path: `${layer}/${entry}`,
        status: parsedStatus?.status || 'placeholder',
        progress: parsedStatus?.progress || 0,
        currentWaypoint: parsedStatus?.currentWaypoint || null,
        waypointName: parsedStatus?.waypointName || null,
        totalWaypoints: null,
        completedWaypoints: null,
        blockers: parsedStatus?.blockers || [],
        ...trackingFiles,
        techStack: [],
        lastActivity: new Date().toISOString().split('T')[0],
      });
    }
  }

  return apps;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(apps: AppStatus[]) {
  const totalApps = apps.length;
  const productionReady = apps.filter(a => a.status === 'ready').length;
  const inDevelopment = apps.filter(a => a.status === 'active').length;
  const skeleton = apps.filter(a => a.status === 'skeleton').length;
  const placeholder = apps.filter(a => a.status === 'placeholder').length;
  const overallProgress = apps.reduce((sum, a) => sum + a.progress, 0) / totalApps;

  return {
    totalApps,
    productionReady,
    inDevelopment,
    skeleton,
    placeholder,
    overallProgress: Math.round(overallProgress * 100) / 100,
  };
}

/**
 * Calculate layer statistics
 */
function calculateLayers(apps: AppStatus[]) {
  const layers: Record<string, { appCount: number; progress: number; apps: string[] }> = {};

  for (const layer of LAYERS) {
    const layerApps = apps.filter(a => a.layer === layer);
    layers[layer] = {
      appCount: layerApps.length,
      progress: layerApps.length > 0
        ? Math.round((layerApps.reduce((sum, a) => sum + a.progress, 0) / layerApps.length) * 100) / 100
        : 0,
      apps: layerApps.map(a => a.path.split('/')[1]),
    };
  }

  return layers;
}

/**
 * Generate progress bar
 */
function progressBar(progress: number, width: number = 5): string {
  const filled = Math.round(progress * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Generate PROGRESS.md dashboard content
 */
function generateProgressMarkdown(apps: AppStatus[], summary: ReturnType<typeof calculateSummary>): string {
  const layers = calculateLayers(apps);

  const overallBar = progressBar(summary.overallProgress, 20);

  let md = `# Business Ecosystem Progress Overview

> Single source of truth for development progress across all services

**Last Updated**: ${new Date().toISOString().split('T')[0]}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Apps | ${summary.totalApps} |
| Production Ready | ${summary.productionReady} |
| In Development | ${summary.inDevelopment} |
| Skeleton/Placeholder | ${summary.skeleton + summary.placeholder} |
| Overall Completion | ${Math.round(summary.overallProgress * 100)}% |

\`\`\`
Overall Progress: ${overallBar} ${Math.round(summary.overallProgress * 100)}%
\`\`\`

---

## Layer Status

`;

  // Generate tables for each layer
  const layerNames: Record<string, string> = {
    foundational: 'Foundational Layer (What the Business IS)',
    operational: 'Operational Layer (What the Business DOES)',
    gateway: 'Gateway Layer (Entry Point)',
  };

  for (const layer of LAYERS) {
    const layerApps = apps.filter(a => a.layer === layer);
    if (layerApps.length === 0) continue;

    md += `### ${layerNames[layer]}

| App | Status | Progress | Current Focus | Blockers |
|-----|--------|----------|---------------|----------|
`;

    for (const app of layerApps) {
      const bar = progressBar(app.progress);
      const pct = Math.round(app.progress * 100);
      const focus = app.waypointName || 'Not started';
      const blockers = app.blockers.length > 0 ? app.blockers.join(', ') : 'None';
      const statusCapitalized = app.status.charAt(0).toUpperCase() + app.status.slice(1);

      md += `| [${app.name.toLowerCase().replace(/\s+/g, '-')}](./${app.path}/STATUS.md) | ${statusCapitalized} | ${bar} ${pct}% | ${focus} | ${blockers} |
`;
    }

    md += `
**${layer.charAt(0).toUpperCase() + layer.slice(1)} Layer**: ${Math.round(layers[layer].progress * 100)}% complete

`;
  }

  md += `---

## Status Legend

| Status | Meaning |
|--------|---------|
| **Ready** | Production-ready, feature complete, tested |
| **Active** | In active development, partially functional |
| **Skeleton** | Structure exists, minimal implementation |
| **Placeholder** | Directory only, no implementation |

---

## How to Use This Dashboard

1. **Check app status**: Click any app link to see detailed STATUS.md
2. **See roadmap**: Apps with PATH.md have detailed waypoint tracking
3. **View learnings**: Apps with LIGHT.md have accumulated insights
4. **Update status**: After completing work, update the app's STATUS.md

---

*Auto-generated from STATUS.md files. Run \`pnpm progress\` to update.*
`;

  return md;
}

/**
 * Main function
 */
function main() {
  console.log('Scanning apps...');
  const apps = discoverApps();
  console.log(`Found ${apps.length} apps`);

  const summary = calculateSummary(apps);
  const layers = calculateLayers(apps);

  // Generate ECOSYSTEM-STATUS.json
  const status: EcosystemStatus = {
    lastUpdated: new Date().toISOString(),
    version: '1.0.0',
    summary,
    layers,
    apps: Object.fromEntries(apps.map(a => [a.path, a])),
  };

  const jsonPath = join(ROOT_DIR, 'progress', 'ECOSYSTEM-STATUS.json');
  writeFileSync(jsonPath, JSON.stringify(status, null, 2));
  console.log(`Updated ${relative(ROOT_DIR, jsonPath)}`);

  // Generate PROGRESS.md
  const markdownPath = join(ROOT_DIR, 'PROGRESS.md');
  const markdown = generateProgressMarkdown(apps, summary);
  writeFileSync(markdownPath, markdown);
  console.log(`Updated ${relative(ROOT_DIR, markdownPath)}`);

  // Summary
  console.log('\nEcosystem Summary:');
  console.log(`  Total Apps: ${summary.totalApps}`);
  console.log(`  Production Ready: ${summary.productionReady}`);
  console.log(`  In Development: ${summary.inDevelopment}`);
  console.log(`  Overall Progress: ${Math.round(summary.overallProgress * 100)}%`);
}

main();
