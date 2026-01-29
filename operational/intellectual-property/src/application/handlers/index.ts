/**
 * Application Handlers - Public API
 */

// Patent Handlers
export { PatentCommandHandler, type EventPublisher as PatentEventPublisher } from './patent-command.handler.js';
export { PatentQueryHandler, type PaginatedResult as PatentPaginatedResult } from './patent-query.handler.js';

// Trademark Handlers
export { TrademarkCommandHandler, type EventPublisher as TrademarkEventPublisher } from './trademark-command.handler.js';
export { TrademarkQueryHandler, type PaginatedResult as TrademarkPaginatedResult } from './trademark-query.handler.js';

// License Handlers
export { LicenseCommandHandler, type EventPublisher as LicenseEventPublisher } from './license-command.handler.js';
export { LicenseQueryHandler, type PaginatedResult as LicensePaginatedResult } from './license-query.handler.js';

// Trade Secret Handlers
export { TradeSecretCommandHandler, type EventPublisher as TradeSecretEventPublisher } from './trade-secret-command.handler.js';
export { TradeSecretQueryHandler } from './trade-secret-query.handler.js';

// Unified types
export interface EventPublisher {
  publish(eventType: string, aggregateId: string, payload: Record<string, unknown>): Promise<void>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
