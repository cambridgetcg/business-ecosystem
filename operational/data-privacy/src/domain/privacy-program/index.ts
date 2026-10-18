/**
 * Privacy Program Domain Module
 * Program-level metrics, dashboards, and compliance reporting
 */

// Models
export type {
  PrivacyProgramMetrics,
  ComplianceDashboard,
  DSARMetrics,
  ConsentMetrics,
  BreachMetrics,
  DPIAMetrics,
  ProcessorMetrics,
  TransferMetrics,
  ActivityMetrics,
  ActionItem,
  ComplianceLevel,
  TrendDirection,
} from './models/privacy-metrics.js';

export {
  calculateComplianceScore,
  getComplianceLevel,
  generateActionItems,
  calculateRiskSummary,
  generateAlerts,
} from './models/privacy-metrics.js';

// Service
export { MetricsService, createStubProviders } from './services/metrics.service.js';
export type { MetricProviders, ServiceResult, ServiceError } from './services/metrics.service.js';
