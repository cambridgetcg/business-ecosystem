/**
 * Customer Contracts - Zod Validators
 */

import { z } from 'zod';

export const ContractStatusEnum = z.enum([
  'DRAFT', 'PENDING_REVIEW', 'IN_NEGOTIATION', 'PENDING_APPROVAL',
  'PENDING_SIGNATURE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'RENEWED', 'ARCHIVED'
]);

export const PartyRoleEnum = z.enum([
  'BUYER', 'SELLER', 'SERVICE_PROVIDER', 'CLIENT', 'EMPLOYER',
  'EMPLOYEE', 'LANDLORD', 'TENANT', 'LICENSOR', 'LICENSEE', 'GUARANTOR', 'WITNESS', 'OTHER'
]);

export const CreateContractPartySchema = z.object({
  partyId: z.string().cuid(),
  role: PartyRoleEnum,
  isPrimary: z.boolean().default(false),
});

export const CreateContractSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  paymentTerms: z.string().max(1000).optional(),
  autoRenewal: z.boolean().default(false),
  renewalTermDays: z.number().int().positive().optional(),
  renewalNoticeDays: z.number().int().positive().optional(),
  templateId: z.string().cuid().optional(),
  parties: z.array(CreateContractPartySchema).min(1),
}).refine(
  (data) => !data.expiryDate || !data.effectiveDate || data.expiryDate > data.effectiveDate,
  { message: 'Expiry date must be after effective date', path: ['expiryDate'] }
);

export const UpdateContractSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  paymentTerms: z.string().max(1000).optional(),
  autoRenewal: z.boolean().optional(),
  renewalTermDays: z.number().int().positive().optional(),
  renewalNoticeDays: z.number().int().positive().optional(),
});

export const ContractQuerySchema = z.object({
  status: ContractStatusEnum.optional(),
  search: z.string().optional(),
  partyId: z.string().cuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'effectiveDate', 'expiryDate', 'title', 'value']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const SignContractSchema = z.object({
  partyId: z.string().cuid(),
  signatureRef: z.string().optional(),
  signedBy: z.string().min(1),
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type ContractQuery = z.infer<typeof ContractQuerySchema>;
export type SignContractInput = z.infer<typeof SignContractSchema>;
