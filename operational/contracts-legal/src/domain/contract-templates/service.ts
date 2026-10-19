/**
 * Contract Templates - Service Layer
 */

import { Prisma } from '#prisma';
import { TemplateRepository, TemplateWithClauses } from './repository.js';
import { CreateTemplateInput, UpdateTemplateInput, TemplateQuery, GenerateContractInput } from './validators.js';
import { NotFoundError, BusinessRuleError, ConflictError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

export class TemplateService {
  private log = logger.child({ domain: 'contract-templates' });

  constructor(private repository: TemplateRepository) {}

  async getTemplate(id: string): Promise<TemplateWithClauses> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotFoundError('Contract Template', id);
    }
    return template;
  }

  async listTemplates(query: TemplateQuery) {
    const { data, total } = await this.repository.findMany(query);
    return { data, total, page: query.page, limit: query.limit };
  }

  async createTemplate(input: CreateTemplateInput, userId: string): Promise<TemplateWithClauses> {
    // Check for duplicate name
    const existing = await this.repository.findByName(input.name);
    if (existing) {
      throw new ConflictError('A template with this name already exists', 'ContractTemplate', 'name');
    }

    const createData: Prisma.ContractTemplateCreateInput = {
      name: input.name,
      type: input.type,
      content: input.content,
      version: input.version,
      isActive: input.isActive,
      createdBy: userId,
    };

    if (input.description) createData.description = input.description;
    if (input.variables) createData.variables = input.variables as Prisma.InputJsonValue;
    
    if (input.clauses && input.clauses.length > 0) {
      createData.clauses = {
        create: input.clauses.map(c => ({
          name: c.name,
          content: c.content,
          isRequired: c.isRequired,
          order: c.order,
        })),
      };
    }

    const template = await this.repository.create(createData);
    this.log.info({ templateId: template.id, name: input.name }, 'Template created');
    return template;
  }

  async updateTemplate(id: string, input: UpdateTemplateInput, userId: string): Promise<TemplateWithClauses> {
    const existing = await this.getTemplate(id);

    // Check usage before major changes
    if (input.type && input.type !== existing.type) {
      const usageCount = await this.repository.getUsageCount(id);
      if (usageCount > 0) {
        throw new BusinessRuleError('Cannot change type of template that has been used to create contracts');
      }
    }

    const updateData: Prisma.ContractTemplateUpdateInput = {};
    if (input.name) updateData.name = input.name;
    if (input.description) updateData.description = input.description;
    if (input.type) updateData.type = input.type;
    if (input.content) updateData.content = input.content;
    if (input.variables) updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const template = await this.repository.update(id, updateData);
    this.log.info({ templateId: id }, 'Template updated');
    return template;
  }

  async publishNewVersion(id: string, newVersion: string, userId: string): Promise<TemplateWithClauses> {
    const existing = await this.getTemplate(id);

    // Validate version is higher
    if (newVersion <= existing.version) {
      throw new BusinessRuleError('New version must be higher than current version ' + existing.version);
    }

    const template = await this.repository.update(id, {
      version: newVersion,
      reviewedBy: userId,
      reviewedAt: new Date(),
    });

    this.log.info({ templateId: id, version: newVersion }, 'Template version published');
    return template;
  }

  async deactivateTemplate(id: string, userId: string): Promise<TemplateWithClauses> {
    const template = await this.repository.update(id, { isActive: false });
    this.log.info({ templateId: id }, 'Template deactivated');
    return template;
  }

  async deleteTemplate(id: string) {
    const existing = await this.getTemplate(id);

    const usageCount = await this.repository.getUsageCount(id);
    if (usageCount > 0) {
      throw new BusinessRuleError('Cannot delete template that has been used to create ' + usageCount + ' contracts');
    }

    await this.repository.delete(id);
    this.log.info({ templateId: id }, 'Template deleted');
  }

  async generateContractContent(input: GenerateContractInput): Promise<string> {
    const template = await this.getTemplate(input.templateId);

    if (!template.isActive) {
      throw new BusinessRuleError('Cannot generate contract from inactive template');
    }

    let content = template.content;

    // Replace variables in content
    for (const [key, value] of Object.entries(input.variables)) {
      const placeholder = '{{' + key + '}}';
      content = content.split(placeholder).join(String(value));
    }

    // Check for unreplaced variables
    const unreplacedMatch = content.match(/\{\{([^}]+)\}\}/g);
    if (unreplacedMatch) {
      const missing = unreplacedMatch.map(m => m.replace(/[{}]/g, '')).join(', ');
      throw new BusinessRuleError('Missing required variables: ' + missing);
    }

    return content;
  }

  async getUsageStats(id: string) {
    const template = await this.getTemplate(id);
    const usageCount = await this.repository.getUsageCount(id);
    
    return {
      template,
      usageCount,
    };
  }
}

export function createTemplateService(repository: TemplateRepository): TemplateService {
  return new TemplateService(repository);
}
