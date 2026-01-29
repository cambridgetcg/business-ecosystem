/**
 * Contract Templates - Zod Validators
 */

import { z } from 'zod';

export const TemplateContractTypeEnum = z.enum([
  'CUSTOMER', 'VENDOR', 'EMPLOYMENT', 'NDA', 'REAL_ESTATE',
  'PARTNERSHIP', 'LICENSE', 'SERVICE_AGREEMENT', 'LEASE', 'OTHER'
]);

export const TemplateVariableSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
  label: z.string().min(1).max(200),
  required: z.boolean().default(true),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(), // For select type
  validation: z.string().optional(), // Regex pattern
});

export const TemplateClauseSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
  isRequired: z.boolean().default(true),
  order: z.number().int().min(0),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: TemplateContractTypeEnum,
  content: z.string().min(1),
  variables: z.array(TemplateVariableSchema).optional(),
  clauses: z.array(TemplateClauseSchema).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  isActive: z.boolean().default(true),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  type: TemplateContractTypeEnum.optional(),
  content: z.string().min(1).optional(),
  variables: z.array(TemplateVariableSchema).optional(),
  clauses: z.array(TemplateClauseSchema).optional(),
  isActive: z.boolean().optional(),
});

export const TemplateQuerySchema = z.object({
  type: TemplateContractTypeEnum.optional(),
  search: z.string().optional(),
  activeOnly: z.coerce.boolean().default(true),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'name', 'type', 'version']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const GenerateContractSchema = z.object({
  templateId: z.string().cuid(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.date()])),
  title: z.string().min(1).max(500),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateSchema>;
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;
export type GenerateContractInput = z.infer<typeof GenerateContractSchema>;
