/**
 * License Commands
 * Write operations for IP license management
 */

import { z } from 'zod';

const IpTypeSchema = z.enum(['patent', 'trademark', 'copyright', 'trade_secret']);
const LicenseTypeSchema = z.enum(['exclusive', 'non_exclusive', 'sole', 'sublicense']);

const RoyaltyTermsSchema = z.object({
  type: z.enum(['percentage', 'fixed', 'tiered', 'hybrid']),
  rate: z.number().min(0).optional(),
  minimumAnnual: z.number().min(0).optional(),
  paymentFrequency: z.enum(['monthly', 'quarterly', 'annually', 'one_time']),
  currency: z.string().length(3).default('USD'),
});

export const CreateLicenseCommandSchema = z.object({
  ipType: IpTypeSchema,
  ipAssetId: z.string().uuid(),
  licenseType: LicenseTypeSchema,
  licensorId: z.string().uuid(),
  licenseeId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  expirationDate: z.coerce.date().optional(),
  territory: z.array(z.string()).min(1),
  royaltyTerms: RoyaltyTermsSchema,
  fieldOfUse: z.string().max(2000).optional(),
  canSublicense: z.boolean().default(false),
  sublicenseOf: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});

export type CreateLicenseCommand = z.infer<typeof CreateLicenseCommandSchema>;

export const UpdateLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  territory: z.array(z.string()).min(1).optional(),
  royaltyTerms: RoyaltyTermsSchema.optional(),
  fieldOfUse: z.string().max(2000).optional(),
  actorId: z.string().uuid().optional(),
});

export type UpdateLicenseCommand = z.infer<typeof UpdateLicenseCommandSchema>;

export const ActivateLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type ActivateLicenseCommand = z.infer<typeof ActivateLicenseCommandSchema>;

export const SuspendLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
  actorId: z.string().uuid().optional(),
});

export type SuspendLicenseCommand = z.infer<typeof SuspendLicenseCommandSchema>;

export const TerminateLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  terminationDate: z.coerce.date(),
  reason: z.string().min(1).max(1000),
  actorId: z.string().uuid().optional(),
});

export type TerminateLicenseCommand = z.infer<typeof TerminateLicenseCommandSchema>;

export const ExpireLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type ExpireLicenseCommand = z.infer<typeof ExpireLicenseCommandSchema>;

export const DeleteLicenseCommandSchema = z.object({
  licenseId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
});

export type DeleteLicenseCommand = z.infer<typeof DeleteLicenseCommandSchema>;
