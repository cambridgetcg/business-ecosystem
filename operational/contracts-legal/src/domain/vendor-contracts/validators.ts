/**
 * Vendor Contracts - Zod Validators
 */

import { z } from 'zod';

export const VendorContractStatusEnum = z.enum([
  'DRAFT', 'PENDING_REVIEW', 'IN_NEGOTIATION', 'PENDING_APPROVAL',
  'PENDING_SIGNATURE', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED', 'RENEWED', 'ARCHIVED'
]);

export const VendorTypeEnum = z.enum([
  'SUPPLIER', 'SERVICE_PROVIDER', 'CONSULTANT', 'CONTRACTOR', 'TECHNOLOGY', 'OTHER'
]);

export const CreateVendorPartySchema = z.object({
  partyId: z.string().cuid(),
  role: z.enum(['SERVICE_PROVIDER', 'CLIENT', 'BUYER', 'OTHER']),
  isPrimary: z.boolean().default(false),
});

export const CreateVendorContractSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  vendorType: VendorTypeEnum,
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  paymentTerms: z.string().max(1000).optional(),
  autoRenewal: z.boolean().default(false),
  renewalTermDays: z.number().int().positive().optional(),
  renewalNoticeDays: z.number().int().positive().optional(),
  templateId: z.string().cuid().optional(),
  parties: z.array(CreateVendorPartySchema).min(1),
  // Vendor-specific fields
  serviceDescription: z.string().max(5000).optional(),
  deliverables: z.array(z.string()).optional(),
  slaTerms: z.string().max(2000).optional(),
  insuranceRequired: z.boolean().default(false),
  insuranceMinimum: z.number().positive().optional(),
}).refine(
  (data) => !data.expiryDate || !data.effectiveDate || data.expiryDate > data.effectiveDate,
  { message: 'Expiry date must be after effective date', path: ['expiryDate'] }
);

export const UpdateVendorContractSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  vendorType: VendorTypeEnum.optional(),
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  paymentTerms: z.string().max(1000).optional(),
  autoRenewal: z.boolean().optional(),
  renewalTermDays: z.number().int().positive().optional(),
  renewalNoticeDays: z.number().int().positive().optional(),
  serviceDescription: z.string().max(5000).optional(),
  deliverables: z.array(z.string()).optional(),
  slaTerms: z.string().max(2000).optional(),
  insuranceRequired: z.boolean().optional(),
  insuranceMinimum: z.number().positive().optional(),
});

export const VendorContractQuerySchema = z.object({
  status: VendorContractStatusEnum.optional(),
  vendorType: VendorTypeEnum.optional(),
  search: z.string().optional(),
  partyId: z.string().cuid().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'effectiveDate', 'expiryDate', 'title', 'value']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateVendorContractInput = z.infer<typeof CreateVendorContractSchema>;
export type UpdateVendorContractInput = z.infer<typeof UpdateVendorContractSchema>;
export type VendorContractQuery = z.infer<typeof VendorContractQuerySchema>;
