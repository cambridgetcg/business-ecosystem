/**
 * Officer Domain Model
 *
 * Represents a corporate officer (CEO, CFO, etc.) of a legal entity.
 */

import { z } from 'zod';
import { OfficerTitleSchema } from '../../value-objects/index.js';

// =============================================================================
// Schemas
// =============================================================================

export const CreateOfficerInputSchema = z.object({
  entityId: z.string().uuid(),
  personId: z.string().uuid(),
  name: z.string().min(1).max(255),
  title: OfficerTitleSchema,
  customTitle: z.string().max(100).optional(),
  email: z.string().email().optional(),
  appointmentDate: z.date(),
  compensationAmount: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateOfficerInputSchema = z.object({
  title: OfficerTitleSchema.optional(),
  customTitle: z.string().max(100).optional().nullable(),
  email: z.string().email().optional().nullable(),
  compensationAmount: z.number().int().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const OfficerSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().uuid(),
  personId: z.string().uuid(),
  name: z.string(),
  title: OfficerTitleSchema,
  customTitle: z.string().nullable(),
  email: z.string().nullable(),
  appointmentDate: z.date(),
  terminationDate: z.date().nullable(),
  compensationAmount: z.number().int().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int(),
});

// =============================================================================
// Types
// =============================================================================

export type Officer = z.infer<typeof OfficerSchema>;
export type CreateOfficerInput = z.infer<typeof CreateOfficerInputSchema>;
export type UpdateOfficerInput = z.infer<typeof UpdateOfficerInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if an officer is currently active (not terminated)
 */
export function isActiveOfficer(officer: Officer): boolean {
  return officer.terminationDate === null;
}

/**
 * Check if an officer can be terminated
 */
export function canTerminate(officer: Officer): boolean {
  return officer.terminationDate === null;
}

/**
 * Format officer's display title
 */
export function formatOfficerTitle(officer: Officer): string {
  if (officer.customTitle) {
    return officer.customTitle;
  }

  const titles: Record<string, string> = {
    ceo: 'Chief Executive Officer',
    cfo: 'Chief Financial Officer',
    coo: 'Chief Operating Officer',
    cto: 'Chief Technology Officer',
    president: 'President',
    vice_president: 'Vice President',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
    general_counsel: 'General Counsel',
    other: 'Officer',
  };

  return titles[officer.title] ?? officer.title;
}
