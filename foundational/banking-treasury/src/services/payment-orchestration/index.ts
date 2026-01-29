/**
 * Payment Orchestration Service
 *
 * Multi-rail payment routing with cost/speed/risk optimization,
 * cutoff awareness, and automatic failover.
 *
 * @module services/payment-orchestration
 */

export { PaymentOrchestrationEngine } from './payment-orchestration-engine.js';

export type {
  PaymentRequest,
  PaymentBeneficiary,
  BeneficiaryAddress,
  ComplianceStatus,
  PaymentExecutionResult,
  PaymentFailure,
  RecoveryAction,
  CutoffStatus,
  RailAvailability,
  OrchestrationMetrics,
  IRailExecutor,
  PaymentStatusUpdate,
} from './types.js';
