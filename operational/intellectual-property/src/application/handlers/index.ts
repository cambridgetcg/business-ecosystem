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

// Deadline Event Handler
export {
  DeadlineEventHandler,
  deadlineEventHandler,
  lambdaHandler,
  type EventHandlerResult,
} from './deadline-event.handler.js';

// Enforcement Event Handler
export {
  EnforcementEventHandler,
  enforcementEventHandler,
  type EnforcementEventType,
  type EnforcementMatterPayload,
  type EnforcementActionPayload,
  type SettlementPayload,
} from './enforcement-event.handler.js';

// Strategy Event Handler
export {
  StrategyEventHandler,
  strategyEventHandler,
  type StrategyEventType,
  type ValuationPayload,
  type FTOPayload,
  type FTOFindingPayload,
  type DueDiligencePayload,
  type DDFindingPayload,
} from './strategy-event.handler.js';

// Enforcement CQRS Handlers
export { EnforcementCommandHandler, type EventPublisher as EnforcementEventPublisher } from './enforcement-command.handler.js';
export { EnforcementQueryHandler, type PaginatedResult as EnforcementPaginatedResult } from './enforcement-query.handler.js';

// Strategy CQRS Handlers
export { StrategyCommandHandler, type EventPublisher as StrategyEventPublisherAlias } from './strategy-command.handler.js';
export { StrategyQueryHandler, type PaginatedResult as StrategyPaginatedResult } from './strategy-query.handler.js';

// Webhook Handler
export {
  WebhookHandler,
  webhookHandler,
  type WebhookEventPublisher,
  type WebhookAlertRepository,
  type WebhookNotificationService,
} from './webhook-handler.js';

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
