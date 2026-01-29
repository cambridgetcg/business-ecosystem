import { z } from 'zod';

/**
 * BOI (Beneficial Ownership Information) Filing Entity
 * Corporate Transparency Act compliance filing
 */

export const BOIFilingStatusSchema = z.enum([
  'draft',
  'pending_review',
  'submitted',
  'accepted',
  'rejected',
  'update_required',
  'exempt',
]);
export type BOIFilingStatus = z.infer<typeof BOIFilingStatusSchema>;

export const ExemptionReasonSchema = z.enum([
  'large_operating_company', // >20 employees, >$5M revenue, US presence
  'tax_exempt_entity',
  'inactive_entity',
  'regulated_entity', // Already reports to FinCEN
  'subsidiary_of_exempt',
  'public_utility',
  'insurance_company',
  'state_licensed_insurance',
  'registered_investment',
  'bank',
  'credit_union',
  'money_services_business',
  'broker_dealer',
  'pooled_investment_vehicle',
  'accounting_firm',
  'public_company',
  'other',
]);
export type ExemptionReason = z.infer<typeof ExemptionReasonSchema>;

export const BeneficialOwnerInfoSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string().max(255),
  dateOfBirth: z.date(),
  residentialAddress: z.object({
    street1: z.string().max(255),
    street2: z.string().max(255).optional(),
    city: z.string().max(100),
    state: z.string().max(100),
    postalCode: z.string().max(20),
    country: z.string().length(2),
  }),
  identificationDocument: z.object({
    type: z.enum(['passport', 'drivers_license', 'state_id', 'foreign_passport']),
    number: z.string().max(100),
    issuingJurisdiction: z.string().max(100),
    expirationDate: z.date().optional(),
    documentImageKey: z.string().max(500).optional(),
  }),
  ownershipPercentage: z.number().min(0).max(100).optional(),
  controlType: z.enum(['ownership', 'control', 'both']),
  isCompanyApplicant: z.boolean().default(false),
});

export type BeneficialOwnerInfo = z.infer<typeof BeneficialOwnerInfoSchema>;

export const BOIFilingSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  filingType: z.enum(['initial', 'updated', 'corrected']),
  status: BOIFilingStatusSchema,
  isExempt: z.boolean(),
  exemptionReason: ExemptionReasonSchema.optional(),
  exemptionJustification: z.string().max(1000).optional(),
  beneficialOwners: z.array(BeneficialOwnerInfoSchema),
  companyApplicants: z.array(BeneficialOwnerInfoSchema).optional(),
  fincenId: z.string().max(50).optional(), // FinCEN identifier if obtained
  submittedAt: z.date().optional(),
  acceptedAt: z.date().optional(),
  rejectionReason: z.string().max(1000).optional(),
  dueDate: z.date(),
  updateDueDate: z.date().optional(), // 30 days after change
  lastChangeDate: z.date().optional(),
  documentStorageKey: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().positive(),
});

export type BOIFiling = z.infer<typeof BOIFilingSchema>;
