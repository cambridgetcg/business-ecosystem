import type { IEntityGovernanceService } from '../contracts/entity-governance-contracts.js';
import type { IAccountingService } from '../contracts/accounting-contracts.js';
import type { IBankingTreasuryService } from '../contracts/banking-treasury-contracts.js';

/**
 * Service Registry
 *
 * Central registry for cross-domain service access.
 * Enables domains to call each other's query interfaces.
 */
export interface ServiceRegistry {
  entityGovernance: IEntityGovernanceService;
  accounting: IAccountingService;
  bankingTreasury: IBankingTreasuryService;
}

/**
 * Service Locator
 *
 * Simple service locator for accessing domain services.
 * In production, this would be replaced with proper DI.
 */
export class ServiceLocator {
  private static instance: ServiceLocator;
  private services: Partial<ServiceRegistry> = {};

  private constructor() {}

  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  register<K extends keyof ServiceRegistry>(
    serviceName: K,
    service: ServiceRegistry[K]
  ): void {
    this.services[serviceName] = service;
  }

  get<K extends keyof ServiceRegistry>(serviceName: K): ServiceRegistry[K] {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service not registered: ${serviceName}`);
    }
    return service as ServiceRegistry[K];
  }

  has(serviceName: keyof ServiceRegistry): boolean {
    return serviceName in this.services;
  }
}

export default ServiceLocator;
