/**
 * Operational Reporting Types
 */

import { z } from 'zod';

export const operationalDomainSchema = z.enum([
  'contracts-legal',
  'insurance',
  'intellectual-property',
  'data-privacy',
]);

export type OperationalDomain = z.infer<typeof operationalDomainSchema>;

export const reportFormatSchema = z.enum(['json', 'pdf', 'excel', 'csv']);
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const reportStatusSchema = z.enum([
  'pending',
  'generating',
  'completed',
  'failed',
]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

// Report Definition (loaded from YAML)
export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required?: boolean;
  default?: unknown;
  description?: string;
}

export interface ReportSource {
  domain: OperationalDomain;
  query: string;
  parameters?: Record<string, string>;
}

export interface ReportSection {
  title: string;
  filter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fields?: string[];
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  parameters: ReportParameter[];
  sources: ReportSource[];
  output: {
    sections: ReportSection[];
    summary?: boolean;
  };
  formats: ReportFormat[];
}

// Report Execution
export interface ReportRequest {
  reportId: string;
  parameters: Record<string, unknown>;
  format: ReportFormat;
  requestedBy?: string;
}

export interface ReportExecution {
  id: string;
  reportId: string;
  reportName: string;
  status: ReportStatus;
  format: ReportFormat;
  parameters: Record<string, unknown>;
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  outputPath?: string;
  outputSize?: number;
}

// Report Data
export interface ReportData {
  reportId: string;
  reportName: string;
  generatedAt: Date;
  parameters: Record<string, unknown>;
  sections: ReportSectionData[];
  summary?: ReportSummary;
}

export interface ReportSectionData {
  title: string;
  items: ReportItem[];
  count: number;
}

export interface ReportItem {
  domain: OperationalDomain;
  type: string;
  id: string;
  title: string;
  status?: string;
  date?: Date;
  metadata?: Record<string, unknown>;
}

export interface ReportSummary {
  totalItems: number;
  byDomain: Record<OperationalDomain, number>;
  byType: Record<string, number>;
  generationTime: number;
}

// Scheduling
export interface ScheduleConfig {
  report: string;
  cron: string;
  parameters: Record<string, unknown>;
  format: ReportFormat;
  distribution?: DistributionConfig[];
  enabled?: boolean;
}

export interface DistributionConfig {
  type: 'email' | 'slack' | 'webhook';
  recipients?: string[];
  channel?: string;
  url?: string;
}

export interface ScheduledReport {
  id: string;
  config: ScheduleConfig;
  lastRun?: Date;
  nextRun?: Date;
  lastStatus?: ReportStatus;
}
