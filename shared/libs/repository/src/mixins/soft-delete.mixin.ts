/**
 * Soft Delete Mixin - Adds soft delete capabilities to repositories
 * @module @ecosystem/repository
 */

import { eq, isNull, isNotNull, lt, and } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

import { DrizzleRepository, type DrizzleDb, type TableConfig } from '../drizzle/drizzle-repository.js';
import type { SoftDeletableEntity } from '../interfaces/types.js';
import type { SoftDeleteRepository } from '../interfaces/repository.interface.js';
import { EntityNotFoundError } from '../interfaces/types.js';

/**
 * Extended table config for soft-deletable entities
 */
export interface SoftDeleteTableConfig<T extends SoftDeletableEntity> extends TableConfig<T> {
  columns: TableConfig<T>['columns'] & {
    deletedAt: PgColumn;
    deletedBy?: PgColumn;
  };
}

/**
 * Repository with soft delete support
 */
export class SoftDeleteDrizzleRepository<T extends SoftDeletableEntity>
  extends DrizzleRepository<T>
  implements SoftDeleteRepository<T>
{
  protected readonly softDeleteConfig: SoftDeleteTableConfig<T>;

  constructor(
    db: DrizzleDb,
    config: SoftDeleteTableConfig<T>,
    entityName: string
  ) {
    super(db, config, entityName);
    this.softDeleteConfig = config;
  }

  /**
   * Soft delete entity by setting deletedAt timestamp
   */
  async softDelete(id: string, deletedBy?: string): Promise<void> {
    const now = this.now();
    const updateData: Record<string, unknown> = {
      deletedAt: now,
      updatedAt: now,
    };

    if (deletedBy && this.softDeleteConfig.columns.deletedBy) {
      updateData.deletedBy = deletedBy;
    }

    const results = await this.db
      .update(this.config.table)
      .set(updateData)
      .where(
        and(
          eq(this.config.columns.id, id),
          isNull(this.softDeleteConfig.columns.deletedAt)
        )
      )
      .returning({ id: this.config.columns.id });

    if (results.length === 0) {
      throw new EntityNotFoundError(this.entityName, id);
    }
  }

  /**
   * Restore soft-deleted entity
   */
  async restore(id: string): Promise<T> {
    const updateData: Record<string, unknown> = {
      deletedAt: null,
      deletedBy: null,
      updatedAt: this.now(),
    };

    const results = await this.db
      .update(this.config.table)
      .set(updateData)
      .where(eq(this.config.columns.id, id))
      .returning();

    if (results.length === 0) {
      throw new EntityNotFoundError(this.entityName, id);
    }

    return this.config.toDomain(results[0] as Record<string, unknown>);
  }

  /**
   * Permanently delete soft-deleted entities older than retention period
   */
  async purge(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const results = await this.db
      .delete(this.config.table)
      .where(
        and(
          isNotNull(this.softDeleteConfig.columns.deletedAt),
          lt(this.softDeleteConfig.columns.deletedAt, cutoffDate)
        )
      )
      .returning({ id: this.config.columns.id });

    return results.length;
  }

  /**
   * Override delete to use soft delete by default
   */
  override async delete(id: string): Promise<void> {
    await this.softDelete(id);
  }

  /**
   * Hard delete (bypass soft delete)
   */
  async hardDelete(id: string): Promise<void> {
    await super.delete(id);
  }
}
