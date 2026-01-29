/**
 * Auditable Decorator - Automatically tracks audit fields
 * @module @ecosystem/repository
 */

import type { AuditableEntity } from '../interfaces/types.js';
import type { Repository } from '../interfaces/repository.interface.js';

/**
 * Context provider for audit information
 */
export interface AuditContext {
  /** Get current user ID */
  getCurrentUserId(): string | null;
  /** Get current tenant ID */
  getCurrentTenantId(): string | null;
}

/**
 * Default audit context (no user)
 */
export const defaultAuditContext: AuditContext = {
  getCurrentUserId: () => null,
  getCurrentTenantId: () => null,
};

/**
 * Decorator that wraps a repository to automatically populate audit fields
 */
export class AuditableRepositoryDecorator<T extends AuditableEntity>
  implements Repository<T>
{
  findById: Repository<T>['findById'];
  findAll: Repository<T>['findAll'];
  findBy: Repository<T>['findBy'];
  findOneBy: Repository<T>['findOneBy'];
  exists: Repository<T>['exists'];
  count: Repository<T>['count'];
  delete: Repository<T>['delete'];

  constructor(
    private readonly inner: Repository<T>,
    private readonly context: AuditContext = defaultAuditContext
  ) {
    this.findById = this.inner.findById.bind(this.inner);
    this.findAll = this.inner.findAll.bind(this.inner);
    this.findBy = this.inner.findBy.bind(this.inner);
    this.findOneBy = this.inner.findOneBy.bind(this.inner);
    this.exists = this.inner.exists.bind(this.inner);
    this.count = this.inner.count.bind(this.inner);
    this.delete = this.inner.delete.bind(this.inner);
  }

  /**
   * Create with automatic audit fields
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const userId = this.context.getCurrentUserId() ?? 'system';
    const auditedData = {
      ...data,
      createdBy: userId,
      updatedBy: userId,
      version: 1,
    } as Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

    return this.inner.create(auditedData);
  }

  /**
   * Update with automatic audit fields
   */
  async update(
    id: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    const userId = this.context.getCurrentUserId() ?? 'system';

    // Get current entity to increment version
    const current = await this.inner.findById(id);
    if (!current) {
      throw new Error(`Entity not found: ${id}`);
    }

    const auditedData = {
      ...data,
      updatedBy: userId,
      version: current.version + 1,
    } as Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

    return this.inner.update(id, auditedData);
  }
}

/**
 * Helper to create auditable repository
 */
export function withAudit<T extends AuditableEntity>(
  repository: Repository<T>,
  context?: AuditContext
): Repository<T> {
  return new AuditableRepositoryDecorator(repository, context);
}
