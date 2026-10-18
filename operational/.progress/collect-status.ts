#!/usr/bin/env npx tsx
/**
 * Progress Status Collector
 *
 * Collects all .status.yaml files from the operational ecosystem
 * and generates aggregated progress reports.
 *
 * Usage:
 *   npx tsx .progress/collect-status.ts
 *   npx tsx .progress/collect-status.ts --json
 *   npx tsx .progress/collect-status.ts --markdown
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { parse as parseYaml } from "yaml";

// Types
interface Waypoint {
  id: string;
  name: string;
  status: "pending" | "in-progress" | "complete" | "blocked";
  completedAt?: string;
  blockedBy?: string;
}

interface Module {
  name: string;
  coverage: "gap" | "stub" | "surface" | "solid" | "deep";
  notes?: string;
}

interface Dependencies {
  database: "none" | "schema-only" | "connected" | "migrated";
  messaging: "none" | "publisher" | "subscriber" | "both";
  external?: { name: string; status: string }[];
}

interface Health {
  runnable: boolean;
  tests: "none" | "failing" | "partial" | "passing";
  linting: "none" | "errors" | "warnings" | "clean";
  typecheck: "none" | "errors" | "warnings" | "clean";
}

interface ServiceStatus {
  service: string;
  version: string;
  description: string;
  phase: string;
  progress: {
    percentage: number;
    status: "not-started" | "in-progress" | "blocked" | "complete";
  };
  waypoints: Waypoint[];
  modules: Module[];
  dependencies?: Dependencies;
  health: Health;
  lastUpdated: string;
  updatedBy?: string;
  notes?: string;
}

interface AggregatedStatus {
  generatedAt: string;
  ecosystem: {
    totalServices: number;
    averageProgress: number;
    waypointsComplete: number;
    waypointsTotal: number;
    coverageScore: number;
    healthyServices: number;
  };
  services: ServiceStatus[];
  byPhase: Record<string, string[]>;
  blockers: { service: string; waypoint: string; blockedBy: string }[];
}

// Coverage weights for scoring
const COVERAGE_WEIGHTS: Record<string, number> = {
  gap: 0,
  stub: 0.1,
  surface: 0.3,
  solid: 0.7,
  deep: 1.0,
};

// Find all .status.yaml files
function findStatusFiles(baseDir: string): string[] {
  const files: string[] = [];

  // Domain services
  const domainDirs = ["contracts-legal", "data-privacy", "insurance", "intellectual-property", "gateway"];
  for (const dir of domainDirs) {
    const statusPath = join(baseDir, dir, ".status.yaml");
    if (existsSync(statusPath)) {
      files.push(statusPath);
    }
  }

  // Orchestration services
  const orchestrationDir = join(baseDir, ".orchestration");
  if (existsSync(orchestrationDir)) {
    const orchestrationServices = ["engine", "compliance", "reporting"];
    for (const service of orchestrationServices) {
      const statusPath = join(orchestrationDir, service, ".status.yaml");
      if (existsSync(statusPath)) {
        files.push(statusPath);
      }
    }
  }

  return files;
}

// Parse a .status.yaml file
function parseStatusFile(filePath: string): ServiceStatus | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return parseYaml(content) as ServiceStatus;
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

// Calculate coverage score for a service
function calculateCoverageScore(modules: Module[]): number {
  if (modules.length === 0) return 0;
  const total = modules.reduce((sum, mod) => sum + (COVERAGE_WEIGHTS[mod.coverage] || 0), 0);
  return Math.round((total / modules.length) * 100);
}

// Aggregate all status files
function aggregateStatus(statusFiles: string[]): AggregatedStatus {
  const services: ServiceStatus[] = [];
  const byPhase: Record<string, string[]> = {};
  const blockers: { service: string; waypoint: string; blockedBy: string }[] = [];

  let totalWaypointsComplete = 0;
  let totalWaypoints = 0;
  let totalCoverageScore = 0;
  let healthyServices = 0;

  for (const filePath of statusFiles) {
    const status = parseStatusFile(filePath);
    if (!status) continue;

    services.push(status);

    // Group by phase
    if (!byPhase[status.phase]) {
      byPhase[status.phase] = [];
    }
    byPhase[status.phase].push(status.service);

    // Count waypoints
    for (const wp of status.waypoints) {
      totalWaypoints++;
      if (wp.status === "complete") {
        totalWaypointsComplete++;
      }
      if (wp.status === "blocked" && wp.blockedBy) {
        blockers.push({
          service: status.service,
          waypoint: wp.name,
          blockedBy: wp.blockedBy,
        });
      }
    }

    // Calculate coverage
    totalCoverageScore += calculateCoverageScore(status.modules);

    // Check health
    if (status.health.runnable) {
      healthyServices++;
    }
  }

  const averageProgress = services.length > 0
    ? Math.round(services.reduce((sum, s) => sum + s.progress.percentage, 0) / services.length)
    : 0;

  const averageCoverage = services.length > 0
    ? Math.round(totalCoverageScore / services.length)
    : 0;

  return {
    generatedAt: new Date().toISOString(),
    ecosystem: {
      totalServices: services.length,
      averageProgress,
      waypointsComplete: totalWaypointsComplete,
      waypointsTotal: totalWaypoints,
      coverageScore: averageCoverage,
      healthyServices,
    },
    services,
    byPhase,
    blockers,
  };
}

// Generate Markdown dashboard
function generateMarkdown(aggregated: AggregatedStatus): string {
  const { ecosystem, services, byPhase, blockers } = aggregated;

  let md = `# Operational Ecosystem Progress

> **Generated**: ${new Date(aggregated.generatedAt).toLocaleString()}

## Ecosystem Overview

| Metric | Value |
|--------|-------|
| Total Services | ${ecosystem.totalServices} |
| Average Progress | ${ecosystem.averageProgress}% |
| Waypoints Complete | ${ecosystem.waypointsComplete} / ${ecosystem.waypointsTotal} (${Math.round((ecosystem.waypointsComplete / ecosystem.waypointsTotal) * 100)}%) |
| Coverage Score | ${ecosystem.coverageScore}% |
| Healthy Services | ${ecosystem.healthyServices} / ${ecosystem.totalServices} |

## Progress Visualization

\`\`\`
`;

  // Progress bars for each service
  for (const service of services) {
    const name = service.service.replace("@ecosystem/", "").padEnd(25);
    const pct = service.progress.percentage;
    const filled = Math.round(pct / 5);
    const empty = 20 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const statusIcon = service.progress.status === "complete" ? "✓" :
                       service.progress.status === "blocked" ? "⊘" :
                       service.progress.status === "in-progress" ? "▶" : "○";
    md += `${name} ${bar} ${pct.toString().padStart(3)}% ${statusIcon}\n`;
  }

  md += `\`\`\`

## Services by Phase

`;

  // Services by phase
  const phases = ["1-define", "2-assess", "3-reconnoiter", "4-waypoint", "5-build", "6-operate"];
  for (const phase of phases) {
    const servicesInPhase = byPhase[phase] || [];
    if (servicesInPhase.length > 0) {
      md += `### ${phase}\n`;
      for (const svc of servicesInPhase) {
        md += `- ${svc}\n`;
      }
      md += "\n";
    }
  }

  md += `## Service Details

`;

  // Service details
  for (const service of services) {
    const shortName = service.service.replace("@ecosystem/", "");
    md += `### ${shortName}

**Version**: ${service.version} | **Phase**: ${service.phase} | **Progress**: ${service.progress.percentage}%

${service.description}

**Waypoints**:
| ID | Name | Status |
|----|------|--------|
`;

    for (const wp of service.waypoints) {
      const statusIcon = wp.status === "complete" ? "✅" :
                         wp.status === "in-progress" ? "🔄" :
                         wp.status === "blocked" ? "⛔" : "⏳";
      const extra = wp.completedAt ? ` (${wp.completedAt})` :
                    wp.blockedBy ? ` - ${wp.blockedBy}` : "";
      md += `| ${wp.id} | ${wp.name} | ${statusIcon} ${wp.status}${extra} |\n`;
    }

    md += `
**Module Coverage**:
| Module | Coverage | Notes |
|--------|----------|-------|
`;

    for (const mod of service.modules) {
      const coverageIcon = mod.coverage === "deep" ? "████" :
                           mod.coverage === "solid" ? "███░" :
                           mod.coverage === "surface" ? "██░░" :
                           mod.coverage === "stub" ? "█░░░" : "░░░░";
      md += `| ${mod.name} | ${coverageIcon} ${mod.coverage} | ${mod.notes || "-"} |\n`;
    }

    md += `
**Health**: ${service.health.runnable ? "✅ Runnable" : "❌ Not runnable"} | Tests: ${service.health.tests} | Lint: ${service.health.linting} | Types: ${service.health.typecheck}

---

`;
  }

  // Blockers section
  if (blockers.length > 0) {
    md += `## Blockers

| Service | Waypoint | Blocked By |
|---------|----------|------------|
`;
    for (const blocker of blockers) {
      md += `| ${blocker.service.replace("@ecosystem/", "")} | ${blocker.waypoint} | ${blocker.blockedBy} |\n`;
    }
    md += "\n";
  }

  md += `---

## Coverage Heat Map

\`\`\`
Legend: ████ deep | ███░ solid | ██░░ surface | █░░░ stub | ░░░░ gap

`;

  // Heat map
  for (const service of services) {
    const name = service.service.replace("@ecosystem/", "").padEnd(25);
    const coverages = service.modules.map(m => {
      return m.coverage === "deep" ? "█" :
             m.coverage === "solid" ? "▓" :
             m.coverage === "surface" ? "▒" :
             m.coverage === "stub" ? "░" : "·";
    }).join("");
    md += `${name} ${coverages}\n`;
  }

  md += `\`\`\`

---

*Generated by Progress Tracking System | Part of Purpose Prompter methodology*
`;

  return md;
}

// Main
function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--json");
  const outputMarkdown = args.includes("--markdown") || !outputJson;

  // Get base directory (operational/)
  const baseDir = dirname(dirname(new URL(import.meta.url).pathname));

  console.log("Collecting status files...");
  const statusFiles = findStatusFiles(baseDir);
  console.log(`Found ${statusFiles.length} status files`);

  console.log("Aggregating status...");
  const aggregated = aggregateStatus(statusFiles);

  if (outputJson) {
    const jsonPath = join(baseDir, ".progress", "progress.json");
    writeFileSync(jsonPath, JSON.stringify(aggregated, null, 2));
    console.log(`JSON written to: ${jsonPath}`);
  }

  if (outputMarkdown) {
    const markdown = generateMarkdown(aggregated);
    const mdPath = join(baseDir, "PROGRESS.md");
    writeFileSync(mdPath, markdown);
    console.log(`Markdown written to: ${mdPath}`);
  }

  // Summary
  console.log("\n=== Ecosystem Summary ===");
  console.log(`Services: ${aggregated.ecosystem.totalServices}`);
  console.log(`Average Progress: ${aggregated.ecosystem.averageProgress}%`);
  console.log(`Waypoints: ${aggregated.ecosystem.waypointsComplete}/${aggregated.ecosystem.waypointsTotal}`);
  console.log(`Coverage Score: ${aggregated.ecosystem.coverageScore}%`);
  console.log(`Healthy: ${aggregated.ecosystem.healthyServices}/${aggregated.ecosystem.totalServices}`);

  if (aggregated.blockers.length > 0) {
    console.log(`\nBlockers: ${aggregated.blockers.length}`);
    for (const b of aggregated.blockers) {
      console.log(`  - ${b.service}: ${b.waypoint} (${b.blockedBy})`);
    }
  }
}

main();
