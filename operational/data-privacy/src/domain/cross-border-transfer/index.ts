/**
 * Cross-Border Transfer Domain Module
 * GDPR Chapter V - Transfers of personal data to third countries
 */

// Models
export type {
  DataTransfer,
  TransferImpactAssessment,
  TransferStatus,
  TransferBasis,
  RiskLevel,
  CreateTransferInput,
  UpdateTransferInput,
  TransferImpactAssessmentInput,
  TransferQueryFilter,
} from './models/data-transfer.js';

export {
  hasAdequacyDecision,
  getAdequacyDecision,
  isUSDataPrivacyFramework,
  requiresTransferImpactAssessment,
  canApprove,
  recommendTransferBasis,
  getTransferComplianceStatus,
  calculateTransferRisk,
} from './models/data-transfer.js';

// Repository
export type { TransferRepository } from './repositories/transfer.repository.js';

// Service
export { TransferService } from './services/transfer.service.js';
export type { ServiceResult, ServiceError, TransferRiskAssessment } from './services/transfer.service.js';
