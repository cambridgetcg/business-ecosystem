/**
 * Compliance Aggregator Types
 */

import { z } from 'zod';

export const complianceStatusSchema = z.enum([
  'compliant',
  'non-compliant',
  'pending',
  'not-applicable',
]);

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;

export const operationalDomainSchema = z.enum([
  'contracts-legal',
  'insurance',
  'intellectual-property',
  'data-privacy',
]);

export type OperationalDomain = z.infer<typeof operationalDomainSchema>;

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof severitySchema>;

export interface ComplianceFinding {
  id: string;
  entityId: string;
  domain: OperationalDomain;
  regulation: string;
  requirement: string;
  severity: Severity;
  description: string;
  discoveredAt: Date;
  dueDate?: Date;
  resolvedAt?: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted';
}

export interface DomainComplianceStatus {
  domain: OperationalDomain;
  status: ComplianceStatus;
  regulations: Map<string, RegulationStatus>;
  lastAssessment?: Date;
  nextAssessmentDue?: Date;
  openFindings: number;
}

export interface RegulationStatus {
  regulation: string;
  status: ComplianceStatus;
  lastAssessment?: Date;
  nextAssessmentDue?: Date;
  findings: ComplianceFinding[];
}

export interface EntityComplianceOverview {
  entityId: string;
  entityName?: string;
  overallStatus: ComplianceStatus;
  domains: Map<OperationalDomain, DomainComplianceStatus>;
  totalFindings: number;
  criticalFindings: number;
  lastUpdated: Date;
}

export interface RegulatoryMapping {
  regulation: string;
  description: string;
  domains: {
    domain: OperationalDomain;
    requirements: string[];
  }[];
  assessmentFrequency: 'continuous' | 'quarterly' | 'annual';
}

export interface ComplianceEvent {
  type: 'status_changed' | 'finding_created' | 'finding_resolved' | 'assessment_completed';
  entityId: string;
  domain: OperationalDomain;
  regulation: string;
  payload: unknown;
  occurredAt: Date;
}
