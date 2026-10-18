/**
 * Cash Management Service
 *
 * Real-time cash position tracking, projections, and liquidity alerts.
 *
 * @module services/cash-management
 */

export { CashPositionService } from './cash-position-service.js';
export type {
  IAccountDataSource,
  IFXRateSource,
  ICashFlowSource,
} from './cash-position-service.js';

export type {
  CashPosition,
  ConsolidatedPosition,
  ProjectedPosition,
  AccountBalance,
  FXRateSnapshot,
  DataFreshness,
  LiquidityAlert,
  LiquidityAlertType,
  LiquidityThreshold,
  ScheduledCashFlow,
  CashFlowCategory,
  ProjectionHorizon,
  ProjectionAssumption,
} from './types.js';

// Intercompany eliminations
export {
  IntercompanyService,
  InMemoryIntercompanyDataSource,
  createIntercompanyService,
} from './intercompany-service.js';

export type {
  IntercompanyBalance,
  IntercompanyType,
  EliminationResult,
  EliminationEntry,
  IIntercompanyDataSource,
} from './intercompany-service.js';
