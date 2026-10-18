/**
 * Contract Template Domain Model
 *
 * Reusable contract templates with variable placeholders.
 */

import { z } from 'zod';
import {
  ContractTypeSchema,
  TemplateStatusSchema,
  type TemplateStatus,
} from '../../value-objects/index.js';

// =============================================================================
// Template Variable Schema
// =============================================================================

export const TemplateVariableSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  type: z.enum(['text', 'number', 'date', 'money', 'boolean', 'select']),
  required: z.boolean().default(true),
  defaultValue: z.string().nullable(),
  options: z.array(z.string()).nullable(), // For select type
  validationPattern: z.string().nullable(), // Regex pattern
  helpText: z.string().max(500).nullable(),
});

export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

// =============================================================================
// Template Schema
// =============================================================================

export const ContractTemplateSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  contractType: ContractTypeSchema,
  status: TemplateStatusSchema,

  // Template content
  content: z.string(), // HTML/Markdown with variable placeholders {{variable_name}}
  variables: z.array(TemplateVariableSchema),

  // Versioning
  version: z.number().int().positive(),
  previousVersionId: z.string().uuid().nullable(),

  // Usage tracking
  usageCount: z.number().int().default(0),

  // Approval workflow
  requiresApproval: z.boolean().default(false),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.date().nullable(),

  // Document storage
  documentStorageKey: z.string().max(500).nullable(),

  // Audit
  metadata: z.record(z.unknown()).nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  deletedAt: z.date().nullable(),
});

export type ContractTemplate = z.infer<typeof ContractTemplateSchema>;

// =============================================================================
// Create Input
// =============================================================================

export const CreateTemplateInputSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  contractType: ContractTypeSchema,
  content: z.string().min(1),
  variables: z.array(TemplateVariableSchema).optional(),
  requiresApproval: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;

// =============================================================================
// Update Input
// =============================================================================

export const UpdateTemplateInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  content: z.string().min(1).optional(),
  variables: z.array(TemplateVariableSchema).optional(),
  requiresApproval: z.boolean().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type UpdateTemplateInput = z.infer<typeof UpdateTemplateInputSchema>;

// =============================================================================
// Domain Logic
// =============================================================================

/**
 * Check if template can be used to create contracts
 */
export function canUseTemplate(template: ContractTemplate): boolean {
  return template.status === 'active';
}

/**
 * Check if template can be edited
 */
export function canEditTemplate(template: ContractTemplate): boolean {
  return template.status === 'draft';
}

/**
 * Check if template can be published
 */
export function canPublishTemplate(template: ContractTemplate): boolean {
  if (template.status !== 'draft') {
    return false;
  }

  if (template.requiresApproval && !template.approvedAt) {
    return false;
  }

  return true;
}

/**
 * Check if template can be archived
 */
export function canArchiveTemplate(template: ContractTemplate): boolean {
  return template.status === 'active' || template.status === 'deprecated';
}

/**
 * Extract variable names from template content
 */
export function extractVariables(content: string): string[] {
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (!matches.includes(match[1]!)) {
      matches.push(match[1]!);
    }
  }

  return matches;
}

/**
 * Validate that all variables in content are defined
 */
export function validateVariables(content: string, variables: TemplateVariable[]): string[] {
  const contentVariables = extractVariables(content);
  const definedVariables = new Set(variables.map(v => v.name));
  const missingVariables: string[] = [];

  for (const variable of contentVariables) {
    if (!definedVariables.has(variable)) {
      missingVariables.push(variable);
    }
  }

  return missingVariables;
}

/**
 * Render template with provided values
 */
export function renderTemplate(content: string, values: Record<string, string>): string {
  let rendered = content;

  for (const [name, value] of Object.entries(values)) {
    const placeholder = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, value);
  }

  return rendered;
}

/**
 * Get template status label
 */
export function getTemplateStatusLabel(status: TemplateStatus): string {
  const labels: Record<TemplateStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    archived: 'Archived',
    deprecated: 'Deprecated',
  };
  return labels[status];
}
