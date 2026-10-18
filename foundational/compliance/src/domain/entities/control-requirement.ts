import { z } from 'zod';
import { RequirementCategorySchema, RegulatorTypeSchema } from './regulatory-requirement.js';

/**
 * Control Requirement Entity
 *
 * Defines internal controls that must be implemented to meet regulatory requirements.
 * Controls are mapped to regulatory requirements and tracked for implementation status.
 *
 * This entity supports:
 * - Control frameworks (COSO, COBIT, ISO 27001, etc.)
 * - Control testing and evidence collection
 * - Control deficiency tracking
 * - SOX compliance
 */

export const ControlTypeSchema = z.enum([
  'preventive',     // Prevents errors before they occur
  'detective',      // Identifies errors after they occur
  'corrective',     // Corrects errors that have been detected
  'directive',      // Guides behavior through policies
  'compensating',   // Alternative control when primary is infeasible
]);
export type ControlType = z.infer<typeof ControlTypeSchema>;

export const ControlFrequencySchema = z.enum([
  'continuous',     // Always active
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'as_needed',      // Event-driven
]);
export type ControlFrequency = z.infer<typeof ControlFrequencySchema>;

export const ControlStatusSchema = z.enum([
  'not_implemented',
  'in_design',
  'in_implementation',
  'implemented',
  'operating_effectively',
  'deficient',
  'not_applicable',
]);
export type ControlStatus = z.infer<typeof ControlStatusSchema>;

export const ControlFrameworkSchema = z.enum([
  'coso',           // Committee of Sponsoring Organizations
  'cobit',          // Control Objectives for IT
  'iso27001',       // Information Security
  'iso31000',       // Risk Management
  'sox',            // Sarbanes-Oxley
  'gdpr',           // Data Protection
  'pci_dss',        // Payment Card Industry
  'nist',           // NIST Cybersecurity Framework
  'custom',
]);
export type ControlFramework = z.infer<typeof ControlFrameworkSchema>;

export const ControlRiskLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);
export type ControlRiskLevel = z.infer<typeof ControlRiskLevelSchema>;

export const ControlRequirementSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().nullable(),

  // Control identification
  controlId: z.string().max(50),           // e.g., "FIN-001", "IT-SEC-003"
  name: z.string().min(1).max(255),
  description: z.string().max(4000),

  // Classification
  controlType: ControlTypeSchema,
  framework: ControlFrameworkSchema,
  category: RequirementCategorySchema,
  riskLevel: ControlRiskLevelSchema,

  // Regulatory linkage
  relatedRequirementIds: z.array(z.string().uuid()).nullable(),
  regulators: z.array(RegulatorTypeSchema).nullable(),

  // Control design
  objective: z.string().max(2000),          // What the control achieves
  procedure: z.string().max(4000),          // How the control operates
  frequency: ControlFrequencySchema,
  automationLevel: z.enum(['manual', 'semi_automated', 'fully_automated']),

  // Ownership
  controlOwner: z.string().uuid().nullable(),
  controlOwnerName: z.string().nullable(),
  processOwner: z.string().uuid().nullable(),
  processOwnerName: z.string().nullable(),

  // Status
  status: ControlStatusSchema,
  implementedDate: z.date().nullable(),
  lastTestedDate: z.date().nullable(),
  nextTestDueDate: z.date().nullable(),

  // Testing
  testingFrequency: ControlFrequencySchema.nullable(),
  lastTestResult: z.enum(['pass', 'fail', 'partial', 'not_tested']).nullable(),
  testingProcedure: z.string().max(4000).nullable(),
  sampleSize: z.number().int().nullable(),

  // Evidence
  evidenceRequirements: z.array(z.string()).nullable(),
  evidenceLocations: z.array(z.string()).nullable(),

  // Deficiencies
  deficiencyCount: z.number().int().default(0),
  materialWeakness: z.boolean().default(false),
  significantDeficiency: z.boolean().default(false),

  // Dependencies
  dependsOnControls: z.array(z.string().uuid()).nullable(),
  compensatesFor: z.string().uuid().nullable(),

  // Risk assessment
  inherentRisk: z.number().min(1).max(5).nullable(),
  residualRisk: z.number().min(1).max(5).nullable(),
  controlEffectiveness: z.number().min(1).max(5).nullable(),

  // Audit
  notes: z.string().max(4000).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

export type ControlRequirement = z.infer<typeof ControlRequirementSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateControlInputSchema = z.object({
  tenantId: z.string().uuid(),
  entityId: z.string().uuid().optional(),
  controlId: z.string().max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(4000),
  controlType: ControlTypeSchema,
  framework: ControlFrameworkSchema,
  category: RequirementCategorySchema,
  riskLevel: ControlRiskLevelSchema,
  objective: z.string().max(2000),
  procedure: z.string().max(4000).optional(),
  frequency: ControlFrequencySchema,
  automationLevel: z.enum(['manual', 'semi_automated', 'fully_automated']),
  controlOwner: z.string().uuid().optional(),
  processOwner: z.string().uuid().optional(),
  relatedRequirementIds: z.array(z.string().uuid()).optional(),
  regulators: z.array(RegulatorTypeSchema).optional(),
  testingFrequency: ControlFrequencySchema.optional(),
  testingProcedure: z.string().max(4000).optional(),
  evidenceRequirements: z.array(z.string()).optional(),
  inherentRisk: z.number().min(1).max(5).optional(),
  notes: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateControlInput = z.infer<typeof CreateControlInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateControlInputSchema = z.object({
  status: ControlStatusSchema.optional(),
  controlOwner: z.string().uuid().nullable().optional(),
  lastTestedDate: z.date().optional(),
  nextTestDueDate: z.date().optional(),
  lastTestResult: z.enum(['pass', 'fail', 'partial', 'not_tested']).optional(),
  deficiencyCount: z.number().int().optional(),
  materialWeakness: z.boolean().optional(),
  significantDeficiency: z.boolean().optional(),
  residualRisk: z.number().min(1).max(5).optional(),
  controlEffectiveness: z.number().min(1).max(5).optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateControlInput = z.infer<typeof UpdateControlInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if control needs testing
 */
export function needsTesting(control: ControlRequirement): boolean {
  if (!control.nextTestDueDate) return true;
  return new Date() >= control.nextTestDueDate;
}

/**
 * Calculate days until next test
 */
export function daysUntilNextTest(control: ControlRequirement): number | null {
  if (!control.nextTestDueDate) return null;
  const now = new Date();
  const testDate = new Date(control.nextTestDueDate);
  return Math.ceil((testDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if control has critical deficiencies
 */
export function hasCriticalDeficiency(control: ControlRequirement): boolean {
  return control.materialWeakness || control.significantDeficiency;
}

/**
 * Get control effectiveness label
 */
export function getEffectivenessLabel(effectiveness: number | null): string {
  if (effectiveness === null) return 'Not Assessed';
  if (effectiveness >= 4.5) return 'Highly Effective';
  if (effectiveness >= 3.5) return 'Effective';
  if (effectiveness >= 2.5) return 'Partially Effective';
  if (effectiveness >= 1.5) return 'Ineffective';
  return 'Not Effective';
}

/**
 * Get risk reduction achieved by control
 */
export function getRiskReduction(control: ControlRequirement): number | null {
  if (control.inherentRisk === null || control.residualRisk === null) return null;
  return control.inherentRisk - control.residualRisk;
}

/**
 * Calculate next test date based on frequency
 */
export function calculateNextTestDate(
  lastTestDate: Date,
  frequency: ControlFrequency
): Date {
  const nextDate = new Date(lastTestDate);

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'continuous':
    case 'as_needed':
      // For continuous/as-needed, default to monthly review
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }

  return nextDate;
}

/**
 * Standard UK/SOX controls for financial reporting
 */
export const STANDARD_FINANCIAL_CONTROLS = [
  {
    controlId: 'FIN-001',
    name: 'Segregation of Duties - Journal Entries',
    controlType: 'preventive' as const,
    framework: 'sox' as const,
    category: 'financial_reporting' as const,
    objective: 'Ensure no single individual can initiate and approve journal entries',
    frequency: 'continuous' as const,
    riskLevel: 'high' as const,
  },
  {
    controlId: 'FIN-002',
    name: 'Journal Entry Review and Approval',
    controlType: 'detective' as const,
    framework: 'sox' as const,
    category: 'financial_reporting' as const,
    objective: 'All material journal entries are reviewed and approved before posting',
    frequency: 'daily' as const,
    riskLevel: 'high' as const,
  },
  {
    controlId: 'FIN-003',
    name: 'Bank Reconciliation',
    controlType: 'detective' as const,
    framework: 'sox' as const,
    category: 'financial_reporting' as const,
    objective: 'Ensure recorded cash balances agree to bank statements',
    frequency: 'monthly' as const,
    riskLevel: 'high' as const,
  },
  {
    controlId: 'FIN-004',
    name: 'Period-End Close Checklist',
    controlType: 'directive' as const,
    framework: 'sox' as const,
    category: 'financial_reporting' as const,
    objective: 'All period-end procedures are completed before close',
    frequency: 'monthly' as const,
    riskLevel: 'medium' as const,
  },
  {
    controlId: 'TAX-001',
    name: 'Tax Return Review',
    controlType: 'detective' as const,
    framework: 'custom' as const,
    category: 'corporation_tax' as const,
    objective: 'Tax returns are reviewed by senior finance before submission',
    frequency: 'annually' as const,
    riskLevel: 'high' as const,
  },
  {
    controlId: 'VAT-001',
    name: 'VAT Return Reconciliation',
    controlType: 'detective' as const,
    framework: 'custom' as const,
    category: 'vat' as const,
    objective: 'VAT return figures reconcile to accounting records',
    frequency: 'quarterly' as const,
    riskLevel: 'high' as const,
  },
] as const;
