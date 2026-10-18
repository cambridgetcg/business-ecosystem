/**
 * @ecosystem/test-utils - Mock Implementations
 *
 * Mock implementations for common infrastructure components.
 * These mocks provide in-memory behavior for testing without external dependencies.
 */

import { randomUUID } from 'node:crypto';

// =============================================================================
// Types
// =============================================================================

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

export interface EventHandler<T = unknown> {
  eventType: string;
  handle(event: DomainEvent<T>): Promise<void>;
}

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  publishMany<T>(events: DomainEvent<T>[]): Promise<void>;
  subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(eventType: string): Promise<void>;
}

export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'between';
  value: unknown;
}

export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(params?: PaginationParams): Promise<PaginatedResult<T>>;
  findBy(filters: QueryFilter[]): Promise<T[]>;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  count(filters?: QueryFilter[]): Promise<number>;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

// =============================================================================
// MockEventBus
// =============================================================================

export interface MockEventBusOptions {
  /** If true, dispatches events synchronously */
  sync?: boolean;
  /** If true, stores all published events for later inspection */
  captureEvents?: boolean;
}

/**
 * In-memory event bus for testing.
 * Provides utilities for inspecting published events and simulating handler behavior.
 */
export class MockEventBus implements EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private readonly sync: boolean;
  private readonly captureEvents: boolean;
  private publishedEvents: DomainEvent[] = [];
  private failureMode: { eventType?: string; error?: Error } | null = null;

  constructor(options: MockEventBusOptions = {}) {
    this.sync = options.sync ?? true;
    this.captureEvents = options.captureEvents ?? true;
  }

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    // Check for simulated failures
    if (this.failureMode) {
      if (!this.failureMode.eventType || this.failureMode.eventType === event.type) {
        throw this.failureMode.error ?? new Error('Simulated event bus failure');
      }
    }

    if (this.captureEvents) {
      this.publishedEvents.push(event as DomainEvent);
    }

    const eventType = event.type;
    const handlers = this.handlers.get(eventType) || [];

    // Also check for wildcard handlers
    for (const [pattern, patternHandlers] of this.handlers) {
      if (pattern.includes('*') && this.matchesPattern(eventType, pattern)) {
        handlers.push(...patternHandlers);
      }
    }

    if (this.sync) {
      await Promise.all(handlers.map(handler => handler.handle(event)));
    } else {
      setImmediate(async () => {
        for (const handler of handlers) {
          try {
            await handler.handle(event);
          } catch (error) {
            console.error('[MockEventBus] Handler error:', error);
          }
        }
      });
    }
  }

  async publishMany<T>(events: DomainEvent<T>[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  async subscribe<T>(eventType: string, handler: EventHandler<T>): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.handlers.set(eventType, handlers);
  }

  async unsubscribe(eventType: string): Promise<void> {
    this.handlers.delete(eventType);
  }

  private matchesPattern(eventType: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(eventType);
  }

  // ===========================================================================
  // Testing Utilities
  // ===========================================================================

  /**
   * Get all published events
   */
  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  /**
   * Get published events of a specific type
   */
  getEventsOfType<T>(eventType: string): DomainEvent<T>[] {
    return this.publishedEvents.filter(e => e.type === eventType) as DomainEvent<T>[];
  }

  /**
   * Check if an event of a specific type was published
   */
  hasPublished(eventType: string): boolean {
    return this.publishedEvents.some(e => e.type === eventType);
  }

  /**
   * Check if an event matching a predicate was published
   */
  hasPublishedMatching<T>(predicate: (event: DomainEvent<T>) => boolean): boolean {
    return this.publishedEvents.some(e => predicate(e as DomainEvent<T>));
  }

  /**
   * Get the count of published events
   */
  getPublishedCount(): number {
    return this.publishedEvents.length;
  }

  /**
   * Clear all published events
   */
  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Reset the event bus completely
   */
  reset(): void {
    this.clearPublishedEvents();
    this.clearHandlers();
    this.failureMode = null;
  }

  /**
   * Simulate event bus failure for testing error handling
   */
  simulateFailure(options: { eventType?: string; error?: Error } = {}): void {
    this.failureMode = options;
  }

  /**
   * Stop simulating failures
   */
  stopSimulatingFailure(): void {
    this.failureMode = null;
  }

  /**
   * Wait for async handlers to complete
   */
  async flush(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }
}

// =============================================================================
// MockRepository
// =============================================================================

/**
 * Generic in-memory repository for testing.
 * Stores entities in memory and provides standard CRUD operations.
 */
export class MockRepository<T extends Entity> implements Repository<T> {
  private entities: Map<string, T> = new Map();
  private operationLog: Array<{ operation: string; id?: string; data?: unknown; timestamp: Date }> = [];

  /**
   * Pre-seed the repository with entities
   */
  seed(entities: T[]): void {
    for (const entity of entities) {
      this.entities.set(entity.id, entity);
    }
  }

  async findById(id: string): Promise<T | null> {
    this.logOperation('findById', id);
    return this.entities.get(id) ?? null;
  }

  async findAll(params?: PaginationParams): Promise<PaginatedResult<T>> {
    this.logOperation('findAll');
    const allEntities = Array.from(this.entities.values());
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const start = (page - 1) * limit;
    const end = start + limit;

    // Apply sorting if specified
    let sorted = [...allEntities];
    if (params?.sortBy) {
      sorted.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[params.sortBy!];
        const bVal = (b as Record<string, unknown>)[params.sortBy!];
        if (aVal === bVal) return 0;
        const order = params.sortOrder === 'desc' ? -1 : 1;
        return aVal > bVal ? order : -order;
      });
    }

    const data = sorted.slice(start, end);
    const total = allEntities.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findBy(filters: QueryFilter[]): Promise<T[]> {
    this.logOperation('findBy', undefined, filters);
    const allEntities = Array.from(this.entities.values());

    return allEntities.filter(entity => {
      return filters.every(filter => this.matchesFilter(entity, filter));
    });
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date();
    const entity = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;

    this.logOperation('create', entity.id, data);
    this.entities.set(entity.id, entity);
    return entity;
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T> {
    const existing = this.entities.get(id);
    if (!existing) {
      throw new Error(`Entity with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.logOperation('update', id, data);
    this.entities.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.logOperation('delete', id);
    this.entities.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    this.logOperation('exists', id);
    return this.entities.has(id);
  }

  async count(filters?: QueryFilter[]): Promise<number> {
    this.logOperation('count', undefined, filters);
    if (!filters || filters.length === 0) {
      return this.entities.size;
    }
    const matched = await this.findBy(filters);
    return matched.length;
  }

  // ===========================================================================
  // Testing Utilities
  // ===========================================================================

  /**
   * Get all entities in the repository
   */
  getAllEntities(): T[] {
    return Array.from(this.entities.values());
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.operationLog = [];
  }

  /**
   * Get operation log for verification
   */
  getOperationLog(): Array<{ operation: string; id?: string; data?: unknown; timestamp: Date }> {
    return [...this.operationLog];
  }

  /**
   * Check if a specific operation was performed
   */
  hasPerformed(operation: string, id?: string): boolean {
    return this.operationLog.some(
      log => log.operation === operation && (id === undefined || log.id === id)
    );
  }

  private logOperation(operation: string, id?: string, data?: unknown): void {
    this.operationLog.push({ operation, id, data, timestamp: new Date() });
  }

  private matchesFilter(entity: T, filter: QueryFilter): boolean {
    const value = (entity as Record<string, unknown>)[filter.field];

    switch (filter.operator) {
      case 'eq':
        return value === filter.value;
      case 'ne':
        return value !== filter.value;
      case 'gt':
        return value > (filter.value as number);
      case 'gte':
        return value >= (filter.value as number);
      case 'lt':
        return value < (filter.value as number);
      case 'lte':
        return value <= (filter.value as number);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      case 'like':
        return typeof value === 'string' && typeof filter.value === 'string' &&
          value.toLowerCase().includes(filter.value.toLowerCase());
      case 'between':
        return Array.isArray(filter.value) && filter.value.length === 2 &&
          value >= filter.value[0] && value <= filter.value[1];
      default:
        return false;
    }
  }
}

// =============================================================================
// MockHttpClient
// =============================================================================

export interface MockHttpClientOptions {
  /** Default response status */
  defaultStatus?: number;
  /** Default response headers */
  defaultHeaders?: Record<string, string>;
  /** Default response delay in ms */
  defaultDelay?: number;
}

/**
 * Mock HTTP client for testing external API integrations.
 * Allows pre-programming responses and capturing requests.
 */
export class MockHttpClient {
  private responses: Map<string, HttpResponse[]> = new Map();
  private requestLog: HttpRequest[] = [];
  private readonly defaultStatus: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultDelay: number;
  private failureMode: { urlPattern?: string; error?: Error } | null = null;

  constructor(options: MockHttpClientOptions = {}) {
    this.defaultStatus = options.defaultStatus ?? 200;
    this.defaultHeaders = options.defaultHeaders ?? { 'Content-Type': 'application/json' };
    this.defaultDelay = options.defaultDelay ?? 0;
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(request: HttpRequest): Promise<HttpResponse<T>> {
    // Log the request
    this.requestLog.push(request);

    // Check for simulated failures
    if (this.failureMode) {
      if (!this.failureMode.urlPattern || request.url.includes(this.failureMode.urlPattern)) {
        throw this.failureMode.error ?? new Error('Simulated HTTP failure');
      }
    }

    // Simulate delay
    if (this.defaultDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.defaultDelay));
    }

    // Find a matching response
    const key = `${request.method}:${request.url}`;
    const responses = this.responses.get(key);

    if (responses && responses.length > 0) {
      // Return and remove the first response (queue behavior)
      return responses.shift() as HttpResponse<T>;
    }

    // Return default response
    return {
      status: this.defaultStatus,
      headers: this.defaultHeaders,
      body: {} as T,
    };
  }

  /**
   * Convenience methods
   */
  async get<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, headers });
  }

  async post<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, body, headers });
  }

  async put<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, body, headers });
  }

  async patch<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, body, headers });
  }

  async delete<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, headers });
  }

  // ===========================================================================
  // Response Setup
  // ===========================================================================

  /**
   * Queue a response for a specific request
   */
  onRequest(method: string, url: string, response: HttpResponse): void {
    const key = `${method}:${url}`;
    const existing = this.responses.get(key) || [];
    existing.push(response);
    this.responses.set(key, existing);
  }

  /**
   * Convenience methods for setting up responses
   */
  onGet(url: string, body: unknown, status = 200): void {
    this.onRequest('GET', url, {
      status,
      headers: this.defaultHeaders,
      body,
    });
  }

  onPost(url: string, body: unknown, status = 201): void {
    this.onRequest('POST', url, {
      status,
      headers: this.defaultHeaders,
      body,
    });
  }

  onPut(url: string, body: unknown, status = 200): void {
    this.onRequest('PUT', url, {
      status,
      headers: this.defaultHeaders,
      body,
    });
  }

  onDelete(url: string, status = 204): void {
    this.onRequest('DELETE', url, {
      status,
      headers: this.defaultHeaders,
      body: null,
    });
  }

  // ===========================================================================
  // Testing Utilities
  // ===========================================================================

  /**
   * Get all captured requests
   */
  getRequests(): HttpRequest[] {
    return [...this.requestLog];
  }

  /**
   * Get requests matching method and url pattern
   */
  getRequestsTo(method: string, urlPattern: string): HttpRequest[] {
    return this.requestLog.filter(
      req => req.method === method && req.url.includes(urlPattern)
    );
  }

  /**
   * Check if a request was made
   */
  hasRequested(method: string, urlPattern: string): boolean {
    return this.requestLog.some(
      req => req.method === method && req.url.includes(urlPattern)
    );
  }

  /**
   * Get the last request
   */
  getLastRequest(): HttpRequest | undefined {
    return this.requestLog[this.requestLog.length - 1];
  }

  /**
   * Clear all state
   */
  reset(): void {
    this.responses.clear();
    this.requestLog = [];
    this.failureMode = null;
  }

  /**
   * Simulate HTTP failures
   */
  simulateFailure(options: { urlPattern?: string; error?: Error } = {}): void {
    this.failureMode = options;
  }

  /**
   * Stop simulating failures
   */
  stopSimulatingFailure(): void {
    this.failureMode = null;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a mock event bus for testing
 */
export function createMockEventBus(options?: MockEventBusOptions): MockEventBus {
  return new MockEventBus(options);
}

/**
 * Create a mock repository for testing
 */
export function createMockRepository<T extends Entity>(): MockRepository<T> {
  return new MockRepository<T>();
}

/**
 * Create a mock HTTP client for testing
 */
export function createMockHttpClient(options?: MockHttpClientOptions): MockHttpClient {
  return new MockHttpClient(options);
}

/**
 * Create a domain event for testing
 */
export function createTestEvent<T>(type: string, payload: T, overrides: Partial<DomainEvent<T>> = {}): DomainEvent<T> {
  return {
    id: randomUUID(),
    type,
    timestamp: new Date(),
    payload,
    ...overrides,
  };
}
