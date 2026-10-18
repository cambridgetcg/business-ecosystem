/**
 * Event Handler Registry
 * Declarative registration and bootstrap of event handlers
 */

import type { DomainEvent, EventHandler } from './types.js';
import type { EventBus } from './event-bus.js';

/**
 * Function-based handler definition
 */
export interface HandlerDefinition<T = unknown> {
  eventType: string;
  handler: EventHandler<T> | ((event: DomainEvent<T>) => Promise<void>);
  /** Optional priority (lower = higher priority) */
  priority?: number;
  /** Optional handler name for logging */
  name?: string;
}

/**
 * Handler wrapper that normalizes function handlers to EventHandler interface
 */
class HandlerWrapper<T = unknown> implements EventHandler<T> {
  constructor(
    private readonly fn: (event: DomainEvent<T>) => Promise<void>,
    private readonly handlerName?: string
  ) {}

  async handle(event: DomainEvent<T>): Promise<void> {
    try {
      await this.fn(event);
    } catch (error) {
      console.error(`[Handler:${this.handlerName ?? 'anonymous'}] Error:`, error);
      throw error;
    }
  }
}

/**
 * Event Handler Registry
 * Manages registration and lifecycle of event handlers
 */
export class HandlerRegistry {
  private handlers: Map<string, Array<{ handler: EventHandler; priority: number; name?: string }>> = new Map();
  private bootstrapped = false;

  /**
   * Register a single handler
   */
  register<T>(
    eventType: string,
    handler: EventHandler<T> | ((event: DomainEvent<T>) => Promise<void>),
    options?: { priority?: number; name?: string }
  ): this {
    if (this.bootstrapped) {
      throw new Error('Cannot register handlers after bootstrap');
    }

    const normalizedHandler = this.normalizeHandler(handler, options?.name);
    const handlers = this.handlers.get(eventType) || [];

    const entry: { handler: EventHandler; priority: number; name?: string } = {
      handler: normalizedHandler as EventHandler,
      priority: options?.priority ?? 100,
    };
    if (options?.name) entry.name = options.name;

    handlers.push(entry);

    // Sort by priority (ascending)
    handlers.sort((a, b) => a.priority - b.priority);

    this.handlers.set(eventType, handlers);
    return this;
  }

  /**
   * Register multiple handlers at once
   */
  registerMany(definitions: HandlerDefinition[]): this {
    for (const def of definitions) {
      const opts: { priority?: number; name?: string } = {};
      if (def.priority !== undefined) opts.priority = def.priority;
      if (def.name !== undefined) opts.name = def.name;
      this.register(def.eventType, def.handler, opts);
    }
    return this;
  }

  /**
   * Register a handler for multiple event types
   */
  registerForTypes<T>(
    eventTypes: string[],
    handler: EventHandler<T> | ((event: DomainEvent<T>) => Promise<void>),
    options?: { priority?: number; name?: string }
  ): this {
    for (const eventType of eventTypes) {
      this.register(eventType, handler, options);
    }
    return this;
  }

  /**
   * Bootstrap the registry with an EventBus
   * Subscribes all registered handlers to the bus
   */
  async bootstrap(bus: EventBus): Promise<void> {
    if (this.bootstrapped) {
      throw new Error('Registry already bootstrapped');
    }

    for (const [eventType, handlerDefs] of this.handlers) {
      for (const { handler, name } of handlerDefs) {
        await bus.subscribe(eventType, handler);
        console.log(`[HandlerRegistry] Registered: ${name ?? 'anonymous'} -> ${eventType}`);
      }
    }

    this.bootstrapped = true;
    console.log(`[HandlerRegistry] Bootstrapped ${this.handlers.size} event types`);
  }

  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return [...this.handlers.keys()];
  }

  /**
   * Get handler count for an event type
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }

  /**
   * Check if any handlers are registered for an event type
   */
  hasHandlers(eventType: string): boolean {
    return this.getHandlerCount(eventType) > 0;
  }

  private normalizeHandler<T>(
    handler: EventHandler<T> | ((event: DomainEvent<T>) => Promise<void>),
    name?: string
  ): EventHandler<T> {
    if ('handle' in handler) {
      return handler;
    }
    return new HandlerWrapper(handler, name);
  }
}

/**
 * Create a new handler registry
 */
export function createHandlerRegistry(): HandlerRegistry {
  return new HandlerRegistry();
}

/**
 * Fluent builder for handler definitions
 */
export class HandlerBuilder {
  private definitions: HandlerDefinition[] = [];

  on<T>(
    eventType: string,
    handler: EventHandler<T> | ((event: DomainEvent<T>) => Promise<void>),
    options?: { priority?: number; name?: string }
  ): this {
    const def: HandlerDefinition = {
      eventType,
      handler: handler as EventHandler,
    };
    if (options?.priority !== undefined) def.priority = options.priority;
    if (options?.name !== undefined) def.name = options.name;
    this.definitions.push(def);
    return this;
  }

  build(): HandlerDefinition[] {
    return this.definitions;
  }
}

/**
 * Create a fluent handler builder
 */
export function handlers(): HandlerBuilder {
  return new HandlerBuilder();
}
