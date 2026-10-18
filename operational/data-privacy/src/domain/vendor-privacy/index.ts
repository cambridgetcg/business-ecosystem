/**
 * Vendor Privacy Domain Module
 * GDPR Article 28 - Processor relationships and DPA management
 */

// Models
export type {
  DataProcessor,
  SubProcessor,
  ProcessorStatus,
  ComplianceStatus,
  TransferMechanism,
  DataCategory,
  CreateProcessorInput,
  UpdateProcessorInput,
  RecordDPAInput,
  AddTransferMechanismInput,
  AddSubProcessorInput,
  ProcessorQueryFilter,
} from './models/data-processor.js';

export {
  isEUCountry,
  hasAdequacyDecision,
  requiresTransferMechanism,
  isDPAExpiringSoon,
  isDPAExpired,
  hasValidDPA,
  canActivate,
  isAuditOverdue,
  getComplianceRisk,
} from './models/data-processor.js';

// Repository
export type { ProcessorRepository } from './repositories/processor.repository.js';

// Service
export { ProcessorService } from './services/processor.service.js';
export type { ServiceResult, ServiceError, ProcessorRiskAssessment } from './services/processor.service.js';
