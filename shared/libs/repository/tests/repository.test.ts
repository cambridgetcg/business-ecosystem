/**
 * The repository library's database-independent behaviour: transaction
 * helpers against a stub pg pool (BEGIN, then COMMIT or ROLLBACK, and the
 * client always released), the audit decorator's stamping and versioning,
 * and BaseRepository's single-result and paging rules. No database.
 */
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import {
  AuditableRepositoryDecorator,
  BaseRepository,
  ConcurrencyError,
  DrizzleUnitOfWork,
  EntityNotFoundError,
  createTransactionManager,
  withTransaction,
  type AuditableEntity,
  type PaginatedResult,
  type PaginationParams,
  type QueryFilter,
  type Repository,
} from '../src/index.js';

interface StubPool {
  pool: Pool;
  client: PoolClient;
  queries: string[];
  released: () => number;
}

// A pg pool whose one client records its queries; `fail` makes that query reject.
function stubPool(fail?: string): StubPool {
  const queries: string[] = [];
  let releases = 0;
  const client = {
    query: (sql: string) => {
      queries.push(sql);
      return sql === fail ? Promise.reject(new Error(`${sql} failed`)) : Promise.resolve({});
    },
    release: () => {
      releases += 1;
    },
  } as unknown as PoolClient;
  const pool = { connect: () => Promise.resolve(client) } as unknown as Pool;
  return { pool, client, queries, released: () => releases };
}

describe('withTransaction', () => {
  it('runs the work on the transaction client and commits', async () => {
    const stub = stubPool();
    const result = await withTransaction(stub.pool, (client) => {
      expect(client).toBe(stub.client);
      return Promise.resolve('done');
    });
    expect(result).toBe('done');
    expect(stub.queries).toEqual(['BEGIN', 'COMMIT']);
    expect(stub.released()).toBe(1);
  });

  it('rolls back, releases the client and rethrows when the work fails', async () => {
    const stub = stubPool();
    const failure = new Error('insert failed');
    await expect(withTransaction(stub.pool, () => Promise.reject(failure))).rejects.toBe(failure);
    expect(stub.queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(stub.released()).toBe(1);
  });

  it('does the same through a transaction manager', async () => {
    const stub = stubPool();
    const manager = createTransactionManager(stub.pool);
    await expect(manager.runInTransaction(() => Promise.reject(new Error('no')))).rejects.toThrow(
      'no'
    );
    expect(stub.queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(stub.released()).toBe(1);
  });
});

describe('DrizzleUnitOfWork', () => {
  it('commits work run in a transaction and ends inactive', async () => {
    const stub = stubPool();
    const unit = new DrizzleUnitOfWork(stub.pool);
    expect(unit.isActive()).toBe(false);
    expect(await unit.runInTransaction(() => Promise.resolve(42))).toBe(42);
    expect(stub.queries).toEqual(['BEGIN', 'COMMIT']);
    expect(unit.isActive()).toBe(false);
    expect(stub.released()).toBe(1);
  });

  it('rolls back failed work and rethrows', async () => {
    const stub = stubPool();
    const unit = new DrizzleUnitOfWork(stub.pool);
    await expect(unit.runInTransaction(() => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom'
    );
    expect(stub.queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(unit.isActive()).toBe(false);
  });

  it('refuses a second begin, and commit or getClient without one', async () => {
    const stub = stubPool();
    const unit = new DrizzleUnitOfWork(stub.pool);
    await expect(unit.commit()).rejects.toThrow('No active transaction');
    expect(() => unit.getClient()).toThrow('call begin() first');
    await unit.begin();
    expect(unit.getClient()).toBe(stub.client);
    await expect(unit.begin()).rejects.toThrow('Transaction already active');
    await unit.rollback();
  });

  it('releases the client and ends the transaction even when COMMIT fails', async () => {
    const stub = stubPool('COMMIT');
    const unit = new DrizzleUnitOfWork(stub.pool);
    await unit.begin();
    await expect(unit.commit()).rejects.toThrow('COMMIT failed');
    expect(unit.isActive()).toBe(false);
    expect(stub.released()).toBe(1);
  });
});

interface Contract extends AuditableEntity {
  title: string;
}

class MemoryRepository extends BaseRepository<Contract> {
  rows = new Map<string, Contract>();

  constructor() {
    super('Contract');
  }
  findById(id: string): Promise<Contract | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findAll(): Promise<PaginatedResult<Contract>> {
    const data = [...this.rows.values()];
    return Promise.resolve(this.paginate(data, data.length, { page: 1, limit: 20 }));
  }
  findBy(filters: QueryFilter[]): Promise<Contract[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((row) =>
        filters.every((f) => (row as unknown as Record<string, unknown>)[f.field] === f.value)
      )
    );
  }
  create(data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const row = { ...data, id: this.generateId(), createdAt: this.now(), updatedAt: this.now() };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }
  update(
    id: string,
    data: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Contract> {
    const current = this.rows.get(id);
    if (!current) return Promise.reject(new EntityNotFoundError('Contract', id));
    const row = { ...current, ...data, updatedAt: this.now() };
    this.rows.set(id, row);
    return Promise.resolve(row);
  }
  delete(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }
  exists(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.has(id));
  }
  count(): Promise<number> {
    return Promise.resolve(this.rows.size);
  }
  page(total: number, params?: PaginationParams): PaginatedResult<never> {
    return this.paginate([], total, this.normalizePagination(params));
  }
}

describe('AuditableRepositoryDecorator', () => {
  const as = (userId: string | null) => ({
    getCurrentUserId: () => userId,
    getCurrentTenantId: () => null,
  });

  it('stamps the creating user, or system, and starts at version 1', async () => {
    const inner = new MemoryRepository();
    const created = await new AuditableRepositoryDecorator<Contract>(inner, as('user-7')).create({
      title: 'NDA',
    } as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
    expect(created).toMatchObject({ createdBy: 'user-7', updatedBy: 'user-7', version: 1 });

    const bySystem = await new AuditableRepositoryDecorator<Contract>(inner, as(null)).create({
      title: 'MSA',
    } as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
    expect(bySystem).toMatchObject({ createdBy: 'system', updatedBy: 'system', version: 1 });
  });

  it('bumps the version and the updating user on update, keeping the creator', async () => {
    const inner = new MemoryRepository();
    const created = await new AuditableRepositoryDecorator<Contract>(inner, as('author')).create({
      title: 'NDA',
    } as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);
    const editor: Repository<Contract> = new AuditableRepositoryDecorator(inner, as('editor'));
    const updated = await editor.update(created.id, { title: 'Mutual NDA' });
    expect(updated).toMatchObject({
      title: 'Mutual NDA',
      createdBy: 'author',
      updatedBy: 'editor',
      version: 2,
    });
    await expect(editor.update('missing', { title: 'x' })).rejects.toThrow('Entity not found');
  });
});

describe('BaseRepository', () => {
  it('finds one row, none, or refuses an ambiguous match', async () => {
    const repo = new MemoryRepository();
    const base = { createdBy: 'u', updatedBy: 'u', version: 1 };
    await repo.create({ ...base, title: 'NDA' });
    await repo.create({ ...base, title: 'NDA' });
    await repo.create({ ...base, title: 'MSA' });
    expect((await repo.findOneBy([{ field: 'title', operator: 'eq', value: 'MSA' }]))?.title).toBe(
      'MSA'
    );
    expect(await repo.findOneBy([{ field: 'title', operator: 'eq', value: 'SOW' }])).toBeNull();
    await expect(
      repo.findOneBy([{ field: 'title', operator: 'eq', value: 'NDA' }])
    ).rejects.toThrow('Expected single Contract, found 2');
  });

  it('pages with clamped parameters', () => {
    const repo = new MemoryRepository();
    expect(repo.page(45, { page: 3, limit: 20 })).toMatchObject({
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
    expect(repo.page(45, { page: 0, limit: 500 })).toMatchObject({
      page: 1,
      limit: 100,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(repo.page(0)).toMatchObject({ page: 1, limit: 20, totalPages: 0, hasNext: false });
  });

  it('gives its errors stable codes', () => {
    expect(new EntityNotFoundError('Contract', 'c-1')).toMatchObject({
      code: 'ENTITY_NOT_FOUND',
      message: 'Contract not found: c-1',
    });
    expect(new ConcurrencyError('Contract', 'c-1', 3)).toMatchObject({
      code: 'CONCURRENCY_CONFLICT',
      message: 'Concurrency conflict on Contract c-1: expected version 3',
    });
  });
});
