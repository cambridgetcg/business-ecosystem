/**
 * Service registry configuration
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
}

export const services: ServiceConfig[] = [
  {
    name: 'entity-governance',
    prefix: '/api/v1/entities',
    upstream: process.env.ENTITY_GOVERNANCE_URL || 'http://localhost:3001',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'kyc-identity',
    prefix: '/api/v1/identities',
    upstream: process.env.KYC_IDENTITY_URL || 'http://localhost:3002',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'accounting',
    prefix: '/api/v1/accounting',
    upstream: process.env.ACCOUNTING_URL || 'http://localhost:3003',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'banking-treasury',
    prefix: '/api/v1/banking',
    upstream: process.env.BANKING_TREASURY_URL || 'http://localhost:3004',
    healthCheck: '/health',
    rateLimit: { max: 50, timeWindow: '1 minute' },
    auth: { required: true, roles: ['admin', 'treasury'] },
  },
  {
    name: 'tax',
    prefix: '/api/v1/tax',
    upstream: process.env.TAX_URL || 'http://localhost:3005',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'compliance',
    prefix: '/api/v1/compliance',
    upstream: process.env.COMPLIANCE_URL || 'http://localhost:3006',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'corporate-security',
    prefix: '/api/v1/security',
    upstream: process.env.CORPORATE_SECURITY_URL || 'http://localhost:3007',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true, roles: ['admin', 'security'] },
  },
  {
    name: 'contracts-legal',
    prefix: '/api/v1/contracts',
    upstream: process.env.CONTRACTS_LEGAL_URL || 'http://localhost:3008',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'data-privacy',
    prefix: '/api/v1/privacy',
    upstream: process.env.DATA_PRIVACY_URL || 'http://localhost:3009',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'intellectual-property',
    prefix: '/api/v1/ip',
    upstream: process.env.IP_URL || 'http://localhost:3010',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
  {
    name: 'insurance',
    prefix: '/api/v1/insurance',
    upstream: process.env.INSURANCE_URL || 'http://localhost:3011',
    healthCheck: '/health',
    rateLimit: { max: 100, timeWindow: '1 minute' },
    auth: { required: true },
  },
];

export function getServiceByName(name: string): ServiceConfig | undefined {
  return services.find(s => s.name === name);
}

export function getServiceByPrefix(prefix: string): ServiceConfig | undefined {
  return services.find(s => prefix.startsWith(s.prefix));
}
