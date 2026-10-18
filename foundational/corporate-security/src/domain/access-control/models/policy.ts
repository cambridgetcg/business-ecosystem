/**
 * Access Policy Domain Model
 *
 * Represents access control policies for ABAC/PBAC.
 * Policies define fine-grained access rules based on attributes.
 */

import { z } from 'zod';
import {
  PolicyTypeSchema,
  PolicyEffectSchema,
  PermissionActionSchema,
  ResourceTypeSchema,
  ConditionOperatorSchema,
  PolicyConditionSchema,
} from '../../value-objects/index.js';

// =============================================================================
// Policy Rule Schema
// =============================================================================

export const PolicyRuleSchema = z.object({
  id: z.string().uuid(),
  effect: PolicyEffectSchema,
  actions: z.array(PermissionActionSchema),
  resources: z.array(ResourceTypeSchema),

  // Subject conditions (who)
  subjectConditions: z.array(PolicyConditionSchema).nullable(),

  // Resource conditions (what)
  resourceConditions: z.array(PolicyConditionSchema).nullable(),

  // Environment conditions (when/where)
  environmentConditions: z.array(PolicyConditionSchema).nullable(),

  // Priority (higher = evaluated first)
  priority: z.number().int().default(0),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// =============================================================================
// Access Policy Schema
// =============================================================================

export const AccessPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().nullable(), // null for system policies
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),

  // Policy type
  policyType: PolicyTypeSchema,
  isSystem: z.boolean().default(false),
  enabled: z.boolean().default(true),

  // Target
  targetType: z.enum(['identity', 'role', 'group', 'service', 'all']),
  targetIds: z.array(z.string().uuid()).nullable(), // Specific targets, null for all

  // Rules
  rules: z.array(PolicyRuleSchema),

  // Default effect when no rules match
  defaultEffect: PolicyEffectSchema.default('deny'),

  // Validity period
  validFrom: z.date().nullable(),
  validUntil: z.date().nullable(),

  // Combining algorithm
  combiningAlgorithm: z.enum([
    'deny_overrides',       // Any deny = deny
    'permit_overrides',     // Any allow = allow
    'first_applicable',     // First matching rule
    'only_one_applicable',  // Exactly one must match
  ]).default('deny_overrides'),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  deletedAt: z.date().nullable(),
});

export type AccessPolicy = z.infer<typeof AccessPolicySchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreatePolicyInputSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  policyType: PolicyTypeSchema,
  targetType: z.enum(['identity', 'role', 'group', 'service', 'all']),
  targetIds: z.array(z.string().uuid()).optional(),
  rules: z.array(z.object({
    effect: PolicyEffectSchema,
    actions: z.array(PermissionActionSchema),
    resources: z.array(ResourceTypeSchema),
    subjectConditions: z.array(PolicyConditionSchema).optional(),
    resourceConditions: z.array(PolicyConditionSchema).optional(),
    environmentConditions: z.array(PolicyConditionSchema).optional(),
    priority: z.number().int().optional(),
  })),
  defaultEffect: PolicyEffectSchema.optional(),
  combiningAlgorithm: z.enum([
    'deny_overrides',
    'permit_overrides',
    'first_applicable',
    'only_one_applicable',
  ]).optional(),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreatePolicyInput = z.infer<typeof CreatePolicyInputSchema>;

// =============================================================================
// Access Request (for evaluation)
// =============================================================================

export const AccessRequestSchema = z.object({
  // Subject (who is requesting)
  subjectId: z.string().uuid(),
  subjectType: z.enum(['identity', 'service']),
  subjectAttributes: z.record(z.unknown()),

  // Action (what they want to do)
  action: PermissionActionSchema,

  // Resource (what they want to access)
  resourceType: ResourceTypeSchema,
  resourceId: z.string().uuid().optional(),
  resourceAttributes: z.record(z.unknown()).optional(),

  // Environment
  environment: z.object({
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    timestamp: z.date(),
    location: z.object({
      country: z.string().optional(),
      region: z.string().optional(),
    }).optional(),
    requestId: z.string().optional(),
  }),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;

// =============================================================================
// Access Decision
// =============================================================================

export const AccessDecisionSchema = z.object({
  decision: PolicyEffectSchema,
  matchedPolicies: z.array(z.string().uuid()),
  matchedRules: z.array(z.string().uuid()),
  reason: z.string().optional(),
  obligations: z.array(z.object({
    type: z.string(),
    parameters: z.record(z.unknown()),
  })).optional(),
  evaluatedAt: z.date(),
  evaluationTimeMs: z.number(),
});

export type AccessDecision = z.infer<typeof AccessDecisionSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if policy is currently active
 */
export function isPolicyActive(policy: AccessPolicy): boolean {
  if (!policy.enabled) return false;
  if (policy.deletedAt) return false;

  const now = new Date();
  if (policy.validFrom && policy.validFrom > now) return false;
  if (policy.validUntil && policy.validUntil < now) return false;

  return true;
}

/**
 * Evaluate a condition against a value
 */
export function evaluateCondition(
  condition: z.infer<typeof PolicyConditionSchema>,
  attributes: Record<string, unknown>
): boolean {
  const value = attributes[condition.attribute];

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'contains':
      return typeof value === 'string' && value.includes(String(condition.value));
    case 'not_contains':
      return typeof value === 'string' && !value.includes(String(condition.value));
    case 'starts_with':
      return typeof value === 'string' && value.startsWith(String(condition.value));
    case 'ends_with':
      return typeof value === 'string' && value.endsWith(String(condition.value));
    case 'greater_than':
      return typeof value === 'number' && value > Number(condition.value);
    case 'less_than':
      return typeof value === 'number' && value < Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value as string);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value as string);
    case 'exists':
      return value !== undefined && value !== null;
    case 'not_exists':
      return value === undefined || value === null;
    case 'matches_regex':
      return typeof value === 'string' && new RegExp(String(condition.value)).test(value);
    default:
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic)
 */
export function evaluateConditions(
  conditions: z.infer<typeof PolicyConditionSchema>[] | null,
  attributes: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, attributes));
}

/**
 * Evaluate a single rule
 */
export function evaluateRule(
  rule: PolicyRule,
  request: AccessRequest
): { matches: boolean; effect: z.infer<typeof PolicyEffectSchema> } {
  // Check action
  if (!rule.actions.includes(request.action) && !rule.actions.includes('*')) {
    return { matches: false, effect: 'deny' };
  }

  // Check resource
  if (!rule.resources.includes(request.resourceType) && !rule.resources.includes('*')) {
    return { matches: false, effect: 'deny' };
  }

  // Evaluate subject conditions
  if (!evaluateConditions(rule.subjectConditions, request.subjectAttributes)) {
    return { matches: false, effect: 'deny' };
  }

  // Evaluate resource conditions
  if (!evaluateConditions(rule.resourceConditions, request.resourceAttributes || {})) {
    return { matches: false, effect: 'deny' };
  }

  // Evaluate environment conditions
  const envAttributes = {
    ipAddress: request.environment.ipAddress,
    userAgent: request.environment.userAgent,
    country: request.environment.location?.country,
    region: request.environment.location?.region,
    hour: request.environment.timestamp.getHours(),
    dayOfWeek: request.environment.timestamp.getDay(),
  };
  if (!evaluateConditions(rule.environmentConditions, envAttributes)) {
    return { matches: false, effect: 'deny' };
  }

  return { matches: true, effect: rule.effect };
}

/**
 * Evaluate a policy against a request
 */
export function evaluatePolicy(
  policy: AccessPolicy,
  request: AccessRequest
): AccessDecision {
  const startTime = Date.now();
  const matchedRules: string[] = [];

  if (!isPolicyActive(policy)) {
    return {
      decision: policy.defaultEffect,
      matchedPolicies: [],
      matchedRules: [],
      reason: 'Policy not active',
      evaluatedAt: new Date(),
      evaluationTimeMs: Date.now() - startTime,
    };
  }

  // Sort rules by priority (higher first)
  const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

  let allows: string[] = [];
  let denies: string[] = [];

  for (const rule of sortedRules) {
    const result = evaluateRule(rule, request);
    if (result.matches) {
      matchedRules.push(rule.id);
      if (result.effect === 'allow') {
        allows.push(rule.id);
      } else {
        denies.push(rule.id);
      }

      // For first_applicable, return immediately
      if (policy.combiningAlgorithm === 'first_applicable') {
        return {
          decision: result.effect,
          matchedPolicies: [policy.id],
          matchedRules: [rule.id],
          reason: `First applicable rule: ${rule.id}`,
          evaluatedAt: new Date(),
          evaluationTimeMs: Date.now() - startTime,
        };
      }
    }
  }

  // Apply combining algorithm
  let decision: z.infer<typeof PolicyEffectSchema>;
  let reason: string;

  switch (policy.combiningAlgorithm) {
    case 'deny_overrides':
      decision = denies.length > 0 ? 'deny' : (allows.length > 0 ? 'allow' : policy.defaultEffect);
      reason = denies.length > 0 ? 'Deny overrides' : (allows.length > 0 ? 'Allowed' : 'No matching rules');
      break;
    case 'permit_overrides':
      decision = allows.length > 0 ? 'allow' : (denies.length > 0 ? 'deny' : policy.defaultEffect);
      reason = allows.length > 0 ? 'Permit overrides' : (denies.length > 0 ? 'Denied' : 'No matching rules');
      break;
    case 'only_one_applicable':
      if (matchedRules.length === 1) {
        decision = allows.length > 0 ? 'allow' : 'deny';
        reason = 'Only one applicable';
      } else if (matchedRules.length === 0) {
        decision = policy.defaultEffect;
        reason = 'No matching rules';
      } else {
        decision = 'deny';
        reason = 'Multiple rules matched (indeterminate)';
      }
      break;
    default:
      decision = policy.defaultEffect;
      reason = 'Default effect applied';
  }

  return {
    decision,
    matchedPolicies: matchedRules.length > 0 ? [policy.id] : [],
    matchedRules,
    reason,
    evaluatedAt: new Date(),
    evaluationTimeMs: Date.now() - startTime,
  };
}
