/**
 * Service registry configuration
 *
 * Central configuration for all ecosystem services routed through the gateway.
 * Services are organized by layer: Foundational, Operational, Orchestration.
 */

export interface ServiceConfig {
  name: string;
  prefix: string;
  upstream: string;
  healthCheck?: string;
  rateLimit?: {
    max: number;
    timeWindow: string;
  };
  auth?: {
    required: boolean;
    roles?: string[];
  };
  circuitBreaker?: {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    successThreshold?: number;
  };
  layer: 'foundational' | 'operational' | 'orchestration';
  critical?: boolean;
}

// =============================================================================
// FOUNDATIONAL LAYER SERVICES (What the Business IS)
// =============================================================================

const foundationalServices: ServiceConfig[] = [
  {
    name: 'entity-governance',
    prefix: '/api/v1/entities',
    upstream: process.env.ENTITY_GOVERNANCE_URL || 'http://localhost:3001',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
    critical: true,
  },
  {
    name: 'kyc-identity',
    prefix: '/api/v1/identities',
    upstream: process.env.KYC_IDENTITY_URL || 'http://localhost:3002',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
    critical: true,
  },
  {
    name: 'accounting',
    prefix: '/api/v1/accounting',
    upstream: process.env.ACCOUNTING_URL || 'http://localhost:3003',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
    critical: true,
  },
  {
    name: 'banking-treasury',
    prefix: '/api/v1/banking',
    upstream: process.env.BANKING_TREASURY_URL || 'http://localhost:3004',
    healthCheck: '/health',
    rateLimit: { max: 50, timeWindow: '1 minute' },
    auth: { required: true, roles: ['admin', 'treasury'] },
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 60000 },
    layer: 'foundational',
    critical: true,
  },
  {
    name: 'tax',
    prefix: '/api/v1/tax',
    upstream: process.env.TAX_URL || 'http://localhost:3005',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
  },
  {
    name: 'compliance',
    prefix: '/api/v1/compliance',
    upstream: process.env.COMPLIANCE_URL || 'http://localhost:3006',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
  },
  {
    name: 'corporate-security',
    prefix: '/api/v1/security',
    upstream: process.env.CORPORATE_SECURITY_URL || 'http://localhost:3007',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true, roles: ['admin', 'security'] },
    layer: 'foundational',
    critical: true,
  },
  {
    name: 'contracts-legal-foundational',
    prefix: '/api/v1/contracts',
    upstream: process.env.CONTRACTS_LEGAL_URL || 'http://localhost:3008',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'foundational',
  },
];

// =============================================================================
// OPERATIONAL LAYER SERVICES (What the Business DOES)
// =============================================================================

const operationalServices: ServiceConfig[] = [
  {
    name: 'data-privacy',
    prefix: '/api/v1/privacy',
    upstream: process.env.DATA_PRIVACY_URL || 'http://localhost:3009',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'operational',
  },
  {
    name: 'intellectual-property',
    prefix: '/api/v1/ip',
    upstream: process.env.IP_URL || 'http://localhost:3010',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'operational',
  },
  {
    name: 'insurance',
    prefix: '/api/v1/insurance',
    upstream: process.env.INSURANCE_URL || 'http://localhost:3011',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'operational',
  },
  {
    name: 'contracts-legal-operational',
    prefix: '/api/v1/operational-contracts',
    upstream: process.env.OPERATIONAL_CONTRACTS_URL || 'http://localhost:3012',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'operational',
  },
];

// =============================================================================
// ORCHESTRATION LAYER SERVICES
// =============================================================================

const orchestrationServices: ServiceConfig[] = [
  {
    name: 'operational-gateway',
    prefix: '/api/v1/operational',
    upstream: process.env.OPERATIONAL_GATEWAY_URL || 'http://localhost:3022',
    healthCheck: '/health',
    rateLimit: { max: 200, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'orchestration',
  },
  {
    name: 'workflow-engine',
    prefix: '/api/v1/workflows',
    upstream: process.env.WORKFLOW_ENGINE_URL || 'http://localhost:3020',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
    layer: 'orchestration',
  },
];

// =============================================================================
// COMBINED SERVICES
// =============================================================================

export const services: ServiceConfig[] = [
  ...foundationalServices,
  ...operationalServices,
  ...orchestrationServices,
];

export function getServiceByName(name: string): ServiceConfig | undefined {
  return services.find((s) => s.name === name);
}

export function getServiceByPrefix(prefix: string): ServiceConfig | undefined {
  return services.find((s) => prefix.startsWith(s.prefix));
}

export function getServicesByLayer(layer: ServiceConfig['layer']): ServiceConfig[] {
  return services.filter((s) => s.layer === layer);
}

export function getCriticalServices(): ServiceConfig[] {
  return services.filter((s) => s.critical);
}
