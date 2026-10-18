/**
 * Privacy Impact Assessment Domain Module
 * GDPR Article 35 - Data Protection Impact Assessment
 */

// Models
export type {
  PrivacyImpactAssessment,
  IdentifiedRisk,
  Mitigation,
  ResidualRisk,
  DPIAStatus,
  RiskLevel,
  CreateDPIAInput,
  UpdateDPIAInput,
  AddRiskInput,
  AddMitigationInput,
  DPOConsultationInput,
  ReviewInput,
  DPIAQueryFilter,
} from './models/privacy-impact-assessment.js';

export {
  calculateOverallRisk,
  requiresAuthorityConsultation,
  canSubmitForReview,
  canApprove,
  isTerminal,
  generateAssessmentNumber,
  generateRiskId,
  generateMitigationId,
} from './models/privacy-impact-assessment.js';

// Repository
export type { DPIARepository } from './repositories/dpia.repository.js';

// Service
export { DPIAService } from './services/dpia.service.js';
export type { ServiceResult, ServiceError } from './services/dpia.service.js';
