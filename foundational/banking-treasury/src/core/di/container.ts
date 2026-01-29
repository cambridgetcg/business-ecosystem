/**
 * Dependency Injection Container
 *
 * Lightweight DI container for managing dependencies.
 * Provides registration and resolution of services.
 *
 * @module core/di/container
 */

import { TOKENS } from './tokens.js';

/**
 * Container configuration options
 */
export interface ContainerConfig {
  /** Skip database initialization (for testing) */
  skipDatabase?: boolean;
  /** Skip event publisher initialization (for testing) */
  skipEventPublisher?: boolean;
}

/**
 * Factory function type for lazy instantiation.
 */
type Factory<T> = () => T;

/**
 * Registration entry.
 */
interface Registration<T> {
  instance?: T;
  factory?: Factory<T>;
  singleton: boolean;
}

/**
 * Simple DI Container.
 */
class Container {
  private registrations = new Map<symbol, Registration<unknown>>();
  private parent?: Container;

  /**
   * Register an instance directly.
   */
  registerInstance<T>(token: symbol, instance: T): void {
    this.registrations.set(token, { instance, singleton: true });
  }

  /**
   * Register a factory for lazy instantiation.
   */
  registerFactory<T>(token: symbol, factory: Factory<T>, singleton = true): void {
    this.registrations.set(token, { factory, singleton });
  }

  /**
   * Resolve a dependency.
   */
  resolve<T>(token: symbol): T {
    const registration = this.registrations.get(token);

    if (!registration) {
      if (this.parent) {
        return this.parent.resolve<T>(token);
      }
      throw new Error(`No registration found for token: ${token.toString()}`);
    }

    if (registration.instance !== undefined) {
      return registration.instance as T;
    }

    if (registration.factory) {
      const instance = registration.factory() as T;
      if (registration.singleton) {
        registration.instance = instance;
      }
      return instance;
    }

    throw new Error(`Invalid registration for token: ${token.toString()}`);
  }

  /**
   * Check if a token is registered.
   */
  isRegistered(token: symbol): boolean {
    if (this.registrations.has(token)) {
      return true;
    }
    if (this.parent) {
      return this.parent.isRegistered(token);
    }
    return false;
  }

  /**
   * Create a child container.
   */
  createChildContainer(): Container {
    const child = new Container();
    child.parent = this;
    return child;
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registrations.clear();
  }
}

// Global container instance
const globalContainer = new Container();

/**
 * Initialize the DI container with all dependencies.
 */
export async function initializeContainer(
  config: ContainerConfig = {}
): Promise<Container> {
  // Import EventBus
  const { EventBus } = await import('../events/event-bus.js');
  const eventBus = new EventBus();
  globalContainer.registerInstance(TOKENS.EventBus, eventBus);

  // Database pool would be registered here when not skipped
  // if (!config.skipDatabase) {
  //   const pool = await getPool();
  //   globalContainer.registerInstance(TOKENS.DatabasePool, pool);
  // }

  return globalContainer;
}

/**
 * Register all application services.
 */
export function registerServices(): void {
  // Services are registered lazily when their dependencies are available
  // Example:
  // globalContainer.registerFactory(TOKENS.PaymentOrchestrationEngine, () => {
  //   return new PaymentOrchestrationEngine();
  // });
}

/**
 * Get the global container.
 */
export function getContainer(): Container {
  return globalContainer;
}

/**
 * Resolve a dependency from the global container.
 */
export function resolve<T>(token: symbol): T {
  return globalContainer.resolve<T>(token);
}

/**
 * Check if a dependency is registered.
 */
export function isRegistered(token: symbol): boolean {
  return globalContainer.isRegistered(token);
}

/**
 * Create a child container for scoped dependencies.
 */
export function createChildContainer(): Container {
  return globalContainer.createChildContainer();
}

/**
 * Clear all registrations (for testing).
 */
export function clearContainer(): void {
  globalContainer.clear();
}

/**
 * Register a mock for testing.
 */
export function registerMock<T>(token: symbol, mock: T): void {
  globalContainer.registerInstance(token, mock);
}
