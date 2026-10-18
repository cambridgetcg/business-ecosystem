/**
 * Contract Template Domain Model Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ContractTemplateSchema,
  CreateTemplateInputSchema,
  canUseTemplate,
  canEditTemplate,
  canPublishTemplate,
  canArchiveTemplate,
  extractVariables,
  validateVariables,
  renderTemplate,
  getTemplateStatusLabel,
  type ContractTemplate,
  type TemplateVariable,
} from '../../../src/domain/template/models/template.js';

describe('Contract Template Domain Model', () => {
  // ==========================================================================
  // Test Fixtures
  // ==========================================================================

  const createTestTemplate = (overrides: Partial<ContractTemplate> = {}): ContractTemplate => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    tenantId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Standard NDA',
    description: 'Non-disclosure agreement template',
    contractType: 'nda',
    status: 'draft',
    content: 'This agreement is between {{party_name}} and {{company_name}}.',
    variables: [
      { name: 'party_name', label: 'Party Name', type: 'text', required: true, defaultValue: null, options: null, validationPattern: null, helpText: null },
      { name: 'company_name', label: 'Company Name', type: 'text', required: true, defaultValue: null, options: null, validationPattern: null, helpText: null },
    ],
    version: 1,
    previousVersionId: null,
    usageCount: 0,
    requiresApproval: false,
    approvedBy: null,
    approvedAt: null,
    documentStorageKey: null,
    metadata: null,
    tags: ['legal', 'nda'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    ...overrides,
  });

  // ==========================================================================
  // Schema Validation Tests
  // ==========================================================================

  describe('ContractTemplateSchema', () => {
    it('should validate a complete template', () => {
      const template = createTestTemplate();
      const result = ContractTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      const template = createTestTemplate({ id: 'invalid' });
      const result = ContractTemplateSchema.safeParse(template);
      expect(result.success).toBe(false);
    });

    it('should accept all valid template statuses', () => {
      const statuses = ['draft', 'active', 'archived', 'deprecated'];
      for (const status of statuses) {
        const template = createTestTemplate({ status: status as ContractTemplate['status'] });
        const result = ContractTemplateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });

    it('should accept null for optional fields', () => {
      const template = createTestTemplate({
        description: null,
        previousVersionId: null,
        approvedBy: null,
        approvedAt: null,
        documentStorageKey: null,
        metadata: null,
        tags: null,
      });
      const result = ContractTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateTemplateInputSchema', () => {
    it('should validate valid creation input', () => {
      const input = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'New Template',
        contractType: 'nda',
        content: 'Template content here',
      };
      const result = CreateTemplateInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should require content to be non-empty', () => {
      const input = {
        tenantId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'New Template',
        contractType: 'nda',
        content: '',
      };
      const result = CreateTemplateInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // Domain Logic Tests
  // ==========================================================================

  describe('canUseTemplate', () => {
    it('should return true for active templates', () => {
      const template = createTestTemplate({ status: 'active' });
      expect(canUseTemplate(template)).toBe(true);
    });

    it('should return false for draft templates', () => {
      const template = createTestTemplate({ status: 'draft' });
      expect(canUseTemplate(template)).toBe(false);
    });

    it('should return false for archived templates', () => {
      const template = createTestTemplate({ status: 'archived' });
      expect(canUseTemplate(template)).toBe(false);
    });

    it('should return false for deprecated templates', () => {
      const template = createTestTemplate({ status: 'deprecated' });
      expect(canUseTemplate(template)).toBe(false);
    });
  });

  describe('canEditTemplate', () => {
    it('should return true for draft templates', () => {
      const template = createTestTemplate({ status: 'draft' });
      expect(canEditTemplate(template)).toBe(true);
    });

    it('should return false for active templates', () => {
      const template = createTestTemplate({ status: 'active' });
      expect(canEditTemplate(template)).toBe(false);
    });

    it('should return false for archived templates', () => {
      const template = createTestTemplate({ status: 'archived' });
      expect(canEditTemplate(template)).toBe(false);
    });
  });

  describe('canPublishTemplate', () => {
    it('should return true for draft templates without approval requirement', () => {
      const template = createTestTemplate({
        status: 'draft',
        requiresApproval: false,
      });
      expect(canPublishTemplate(template)).toBe(true);
    });

    it('should return true for approved templates requiring approval', () => {
      const template = createTestTemplate({
        status: 'draft',
        requiresApproval: true,
        approvedAt: new Date(),
      });
      expect(canPublishTemplate(template)).toBe(true);
    });

    it('should return false for unapproved templates requiring approval', () => {
      const template = createTestTemplate({
        status: 'draft',
        requiresApproval: true,
        approvedAt: null,
      });
      expect(canPublishTemplate(template)).toBe(false);
    });

    it('should return false for non-draft templates', () => {
      const template = createTestTemplate({ status: 'active' });
      expect(canPublishTemplate(template)).toBe(false);
    });
  });

  describe('canArchiveTemplate', () => {
    it('should return true for active templates', () => {
      const template = createTestTemplate({ status: 'active' });
      expect(canArchiveTemplate(template)).toBe(true);
    });

    it('should return true for deprecated templates', () => {
      const template = createTestTemplate({ status: 'deprecated' });
      expect(canArchiveTemplate(template)).toBe(true);
    });

    it('should return false for draft templates', () => {
      const template = createTestTemplate({ status: 'draft' });
      expect(canArchiveTemplate(template)).toBe(false);
    });

    it('should return false for already archived templates', () => {
      const template = createTestTemplate({ status: 'archived' });
      expect(canArchiveTemplate(template)).toBe(false);
    });
  });

  describe('extractVariables', () => {
    it('should extract single variable', () => {
      const content = 'Hello {{name}}!';
      expect(extractVariables(content)).toEqual(['name']);
    });

    it('should extract multiple variables', () => {
      const content = '{{greeting}} {{name}}, welcome to {{company}}!';
      expect(extractVariables(content)).toEqual(['greeting', 'name', 'company']);
    });

    it('should not include duplicates', () => {
      const content = '{{name}} and {{name}} again';
      expect(extractVariables(content)).toEqual(['name']);
    });

    it('should return empty array for no variables', () => {
      const content = 'No variables here';
      expect(extractVariables(content)).toEqual([]);
    });

    it('should handle underscores in variable names', () => {
      const content = '{{first_name}} {{last_name}}';
      expect(extractVariables(content)).toEqual(['first_name', 'last_name']);
    });
  });

  describe('validateVariables', () => {
    it('should return empty array when all variables are defined', () => {
      const content = '{{name}} at {{company}}';
      const variables: TemplateVariable[] = [
        { name: 'name', label: 'Name', type: 'text', required: true, defaultValue: null, options: null, validationPattern: null, helpText: null },
        { name: 'company', label: 'Company', type: 'text', required: true, defaultValue: null, options: null, validationPattern: null, helpText: null },
      ];
      expect(validateVariables(content, variables)).toEqual([]);
    });

    it('should return missing variables', () => {
      const content = '{{name}} at {{company}} in {{city}}';
      const variables: TemplateVariable[] = [
        { name: 'name', label: 'Name', type: 'text', required: true, defaultValue: null, options: null, validationPattern: null, helpText: null },
      ];
      expect(validateVariables(content, variables)).toEqual(['company', 'city']);
    });

    it('should return empty array for content without variables', () => {
      const content = 'No variables here';
      expect(validateVariables(content, [])).toEqual([]);
    });
  });

  describe('renderTemplate', () => {
    it('should replace single variable', () => {
      const content = 'Hello {{name}}!';
      const values = { name: 'John' };
      expect(renderTemplate(content, values)).toBe('Hello John!');
    });

    it('should replace multiple variables', () => {
      const content = '{{greeting}} {{name}}!';
      const values = { greeting: 'Hi', name: 'Jane' };
      expect(renderTemplate(content, values)).toBe('Hi Jane!');
    });

    it('should replace all occurrences of same variable', () => {
      const content = '{{name}} and {{name}} again';
      const values = { name: 'Bob' };
      expect(renderTemplate(content, values)).toBe('Bob and Bob again');
    });

    it('should leave unreplaced variables as-is', () => {
      const content = 'Hello {{name}} at {{company}}!';
      const values = { name: 'Alice' };
      expect(renderTemplate(content, values)).toBe('Hello Alice at {{company}}!');
    });
  });

  describe('getTemplateStatusLabel', () => {
    it('should return correct labels', () => {
      expect(getTemplateStatusLabel('draft')).toBe('Draft');
      expect(getTemplateStatusLabel('active')).toBe('Active');
      expect(getTemplateStatusLabel('archived')).toBe('Archived');
      expect(getTemplateStatusLabel('deprecated')).toBe('Deprecated');
    });
  });
});
