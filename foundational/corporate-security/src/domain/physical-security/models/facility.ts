/**
 * Physical Security Domain Models
 *
 * Models for facility management, access zones, badges, and visitor tracking.
 *
 * @module domain/physical-security/models/facility
 */

import { z } from 'zod';

// =============================================================================
// FACILITY
// =============================================================================

export const FacilityTypeSchema = z.enum([
  'headquarters',
  'office',
  'data_center',
  'warehouse',
  'manufacturing',
  'retail',
  'remote_site',
  'other',
]);

export const FacilityStatusSchema = z.enum([
  'active',
  'under_construction',
  'maintenance',
  'decommissioned',
  'inactive',
]);

export const FacilitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(20),
  type: FacilityTypeSchema,
  status: FacilityStatusSchema,

  // Location
  address: z.object({
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string().length(2),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }),

  // Operations
  operatingHours: z.object({
    monday: z.object({ open: z.string(), close: z.string() }).nullable(),
    tuesday: z.object({ open: z.string(), close: z.string() }).nullable(),
    wednesday: z.object({ open: z.string(), close: z.string() }).nullable(),
    thursday: z.object({ open: z.string(), close: z.string() }).nullable(),
    friday: z.object({ open: z.string(), close: z.string() }).nullable(),
    saturday: z.object({ open: z.string(), close: z.string() }).nullable(),
    sunday: z.object({ open: z.string(), close: z.string() }).nullable(),
  }).optional(),
  timezone: z.string().default('UTC'),

  // Security
  securityLevel: z.enum(['low', 'medium', 'high', 'critical']),
  securityManagerId: z.string().uuid().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyProceduresUrl: z.string().url().optional(),

  // Capacity
  capacity: z.number().int().positive().optional(),
  currentOccupancy: z.number().int().min(0).optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().default(1),
});

export type Facility = z.infer<typeof FacilitySchema>;

// =============================================================================
// ACCESS ZONE
// =============================================================================

export const AccessZoneTypeSchema = z.enum([
  'public',
  'reception',
  'general_office',
  'restricted',
  'secure',
  'high_security',
  'server_room',
  'executive',
  'loading_dock',
  'parking',
  'other',
]);

export const AccessZoneSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  facilityId: z.string().uuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  type: AccessZoneTypeSchema,

  // Access control
  requiredClearanceLevel: z.number().int().min(0).max(10).default(0),
  requiredBadgeTypes: z.array(z.string()).optional(),
  requiresEscort: z.boolean().default(false),
  requiresTwoPersonRule: z.boolean().default(false),
  requiresBiometric: z.boolean().default(false),

  // Time restrictions
  accessSchedule: z.object({
    allowedDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])),
    startTime: z.string(), // HH:MM
    endTime: z.string(),   // HH:MM
  }).optional(),

  // Monitoring
  hasCCTV: z.boolean().default(false),
  hasAlarm: z.boolean().default(false),
  hasManTrap: z.boolean().default(false),

  // Hierarchy
  parentZoneId: z.string().uuid().optional(),

  // Metadata
  description: z.string().optional(),
  floorPlanUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccessZone = z.infer<typeof AccessZoneSchema>;

// =============================================================================
// ACCESS BADGE
// =============================================================================

export const BadgeTypeSchema = z.enum([
  'employee',
  'contractor',
  'visitor',
  'temporary',
  'executive',
  'security',
  'maintenance',
  'emergency',
]);

export const BadgeStatusSchema = z.enum([
  'active',
  'suspended',
  'expired',
  'lost',
  'stolen',
  'returned',
  'deactivated',
]);

export const AccessBadgeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid().optional(), // For employees
  visitorId: z.string().uuid().optional(),  // For visitors

  // Badge details
  badgeNumber: z.string().min(1),
  badgeType: BadgeTypeSchema,
  status: BadgeStatusSchema,

  // Access permissions
  clearanceLevel: z.number().int().min(0).max(10),
  authorizedZones: z.array(z.string().uuid()),
  authorizedFacilities: z.array(z.string().uuid()),

  // Validity
  issuedAt: z.date(),
  expiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  lastUsedZoneId: z.string().uuid().optional(),

  // Physical badge
  cardNumber: z.string().optional(), // RFID/NFC card number
  pinEnabled: z.boolean().default(false),
  photoUrl: z.string().url().optional(),

  // Audit
  issuedBy: z.string().uuid(),
  suspendedBy: z.string().uuid().optional(),
  suspendedAt: z.date().optional(),
  suspendedReason: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccessBadge = z.infer<typeof AccessBadgeSchema>;

// =============================================================================
// ACCESS LOG
// =============================================================================

export const AccessEventTypeSchema = z.enum([
  'entry_granted',
  'entry_denied',
  'exit_granted',
  'exit_denied',
  'tailgate_detected',
  'forced_door',
  'door_held_open',
  'invalid_badge',
  'expired_badge',
  'wrong_zone',
  'time_violation',
  'manual_override',
]);

export const AccessLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  facilityId: z.string().uuid(),
  zoneId: z.string().uuid(),

  // Event details
  eventType: AccessEventTypeSchema,
  timestamp: z.date(),

  // Badge/Person
  badgeId: z.string().uuid().optional(),
  badgeNumber: z.string().optional(),
  identityId: z.string().uuid().optional(),
  visitorId: z.string().uuid().optional(),

  // Access point
  accessPointId: z.string().optional(),
  accessPointName: z.string().optional(),
  direction: z.enum(['in', 'out']).optional(),

  // Result
  granted: z.boolean(),
  denialReason: z.string().optional(),

  // Context
  escortBadgeId: z.string().uuid().optional(),
  overriddenBy: z.string().uuid().optional(),
  overrideReason: z.string().optional(),

  metadata: z.record(z.unknown()).optional(),
});

export type AccessLog = z.infer<typeof AccessLogSchema>;

// =============================================================================
// VISITOR
// =============================================================================

export const VisitorStatusSchema = z.enum([
  'pre_registered',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
  'denied',
]);

export const VisitorSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  facilityId: z.string().uuid(),

  // Visitor info
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  photoUrl: z.string().url().optional(),

  // Visit details
  status: VisitorStatusSchema,
  purpose: z.string(),
  hostIdentityId: z.string().uuid(),
  hostName: z.string(),

  // Schedule
  expectedArrival: z.date(),
  expectedDeparture: z.date().optional(),
  actualArrival: z.date().optional(),
  actualDeparture: z.date().optional(),

  // Access
  badgeId: z.string().uuid().optional(),
  authorizedZones: z.array(z.string().uuid()),
  requiresEscort: z.boolean().default(true),
  escortIdentityId: z.string().uuid().optional(),

  // Verification
  idVerified: z.boolean().default(false),
  idType: z.string().optional(),
  ndaSigned: z.boolean().default(false),
  safetyBriefingCompleted: z.boolean().default(false),

  // Denial
  deniedBy: z.string().uuid().optional(),
  deniedAt: z.date().optional(),
  denialReason: z.string().optional(),

  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Visitor = z.infer<typeof VisitorSchema>;

// =============================================================================
// DOMAIN FUNCTIONS
// =============================================================================

export function isBadgeValid(badge: AccessBadge): boolean {
  if (badge.status !== 'active') return false;
  if (badge.expiresAt && badge.expiresAt < new Date()) return false;
  return true;
}

export function canAccessZone(badge: AccessBadge, zone: AccessZone): boolean {
  if (!isBadgeValid(badge)) return false;
  if (badge.clearanceLevel < zone.requiredClearanceLevel) return false;
  if (!badge.authorizedZones.includes(zone.id)) return false;
  return true;
}

export function isWithinAccessSchedule(zone: AccessZone, time: Date = new Date()): boolean {
  if (!zone.accessSchedule) return true;

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const dayOfWeek = days[time.getDay()];

  if (!zone.accessSchedule.allowedDays.includes(dayOfWeek)) return false;

  const timeStr = time.toTimeString().slice(0, 5);
  return timeStr >= zone.accessSchedule.startTime && timeStr <= zone.accessSchedule.endTime;
}
