/**
 * Unit of Work pattern for transaction management
 */

export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

export interface TransactionManager {
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export abstract class BaseUnitOfWork implements UnitOfWork, TransactionManager {
  protected transactionActive = false;

  abstract begin(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;

  isActive(): boolean {
    return this.transactionActive;
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.begin();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}
