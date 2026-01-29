import { z } from 'zod';

/**
 * Regulatory Requirement Entity
 * Defines a compliance requirement from a regulatory body
 */

export const RegulatorTypeSchema = z.enum([
  'sec', // Securities and Exchange Commission
  'finra', // Financial Industry Regulatory Authority
  'fincen', // Financial Crimes Enforcement Network
  'state', // State regulatory bodies
  'ofac', // Office of Foreign Assets Control
  'doj', // Department of Justice
  'irs', // Internal Revenue Service
  'occ', // Office of the Comptroller of the Currency
  'fdic', // Federal Deposit Insurance Corporation
  'cfpb', // Consumer Financial Protection Bureau
  'international', // Foreign regulators
  'other',
]);
export type RegulatorType = z.infer<typeof RegulatorTypeSchema>;

export const RequirementCategorySchema = z.enum([
  'aml', // Anti-Money Laundering
  'kyc', // Know Your Customer
  'cta', // Corporate Transparency Act
  'bsa', // Bank Secrecy Act
  'sanctions', // OFAC Sanctions
  'privacy', // Data privacy (GDPR, CCPA)
  'reporting', // Regulatory reporting
  'licensing', // Business licensing
  'disclosure', // Disclosure requirements
  'record_keeping', // Record retention
  'audit', // Audit requirements
  'governance', // Corporate governance
  'consumer_protection',
  'other',
]);
export type RequirementCategory = z.infer<typeof RequirementCategorySchema>;

export const RegulatoryRequirementSchema = z.object({
  id: z.string().uuid(),
  regulator: RegulatorTypeSchema,
  regulationName: z.string().min(1).max(255),
  regulationReference: z.string().max(100).optional(), // e.g., "31 CFR 1010.230"
  category: RequirementCategorySchema,
  description: z.string().max(2000),
  applicabilityConditions: z.record(z.unknown()).optional(), // Entity type, size, etc.
  deadlineRule: z.string().max(500).optional(), // e.g., "30 days after fiscal year end"
  frequency: z.enum(['one_time', 'annual', 'quarterly', 'monthly', 'ongoing', 'event_driven']),
  penaltyDescription: z.string().max(1000).optional(),
  exemptions: z.array(z.string()).optional(),
  effectiveDate: z.date(),
  sunsetDate: z.date().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RegulatoryRequirement = z.infer<typeof RegulatoryRequirementSchema>;
