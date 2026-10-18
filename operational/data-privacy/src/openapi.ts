/**
 * OpenAPI Specification for Data Privacy Service
 * GDPR/CCPA Compliance API Documentation
 */

import { serviceConfig } from './env.js';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Data Privacy Service API',
    version: serviceConfig.version,
    description: `
GDPR/CCPA compliance and privacy management API.

## Overview
This API provides comprehensive data privacy management covering:
- **Consent Management** (GDPR Art. 6-7)
- **Data Subject Access Requests** (GDPR Art. 15-22)
- **Breach Management** (GDPR Art. 33-34)
- **Privacy Impact Assessments** (GDPR Art. 35-36)
- **Processing Activities Records** (GDPR Art. 30)
- **Vendor/Processor Management** (GDPR Art. 28)
- **Cross-Border Transfers** (GDPR Chapter V)
- **Privacy Program Metrics**

## Authentication
All API requests require authentication via the API Gateway.

## Rate Limiting
- Standard endpoints: 100 requests per minute
- Sensitive operations: 10 requests per minute
- Rate limit headers included in all responses
    `,
    contact: {
      name: 'API Support',
      email: 'api@ecosystem.local',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    { name: 'Consent', description: 'Consent management (GDPR Art. 6-7)' },
    { name: 'DSAR', description: 'Data Subject Access Requests (GDPR Art. 15-22)' },
    { name: 'Breach', description: 'Breach notification (GDPR Art. 33-34)' },
    { name: 'DPIA', description: 'Privacy Impact Assessments (GDPR Art. 35-36)' },
    { name: 'Activities', description: 'Processing Activities (GDPR Art. 30)' },
    { name: 'Processors', description: 'Vendor/Processor Management (GDPR Art. 28)' },
    { name: 'Transfers', description: 'Cross-Border Transfers (GDPR Chapter V)' },
    { name: 'Metrics', description: 'Privacy Program Metrics' },
  ],
  paths: {
    // Consent Management
    '/consent': {
      post: {
        tags: ['Consent'],
        summary: 'Grant consent',
        description: 'Record a new consent grant from a data subject',
        operationId: 'grantConsent',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GrantConsentInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Consent granted successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConsentRecord' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
      get: {
        tags: ['Consent'],
        summary: 'List consents',
        description: 'List consent records with filtering and pagination',
        operationId: 'listConsents',
        parameters: [
          { $ref: '#/components/parameters/entityId' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/offset' },
        ],
        responses: {
          '200': {
            description: 'List of consent records',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ConsentRecord' },
                    },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/consent/check': {
      get: {
        tags: ['Consent'],
        summary: 'Check consent validity',
        description: 'Check if a data subject has valid consent for a specific purpose',
        operationId: 'checkConsent',
        parameters: [
          { name: 'subjectId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'purpose', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Consent check result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    hasConsent: { type: 'boolean' },
                    consent: { $ref: '#/components/schemas/ConsentRecord' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/consent/{id}/withdraw': {
      post: {
        tags: ['Consent'],
        summary: 'Withdraw consent',
        description: 'Withdraw a previously granted consent',
        operationId: 'withdrawConsent',
        parameters: [{ $ref: '#/components/parameters/id' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' },
                  withdrawnBy: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Consent withdrawn' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // DSAR
    '/dsar': {
      post: {
        tags: ['DSAR'],
        summary: 'Submit DSAR',
        description: 'Submit a new Data Subject Access Request',
        operationId: 'submitDSAR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateDSARInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'DSAR submitted successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DSARRequest' },
              },
            },
          },
        },
      },
    },
    '/dsar/{id}': {
      get: {
        tags: ['DSAR'],
        summary: 'Get DSAR',
        description: 'Retrieve a DSAR by ID',
        operationId: 'getDSAR',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': {
            description: 'DSAR details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DSARRequest' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/dsar/{id}/verify': {
      post: {
        tags: ['DSAR'],
        summary: 'Verify identity',
        description: 'Verify data subject identity for a DSAR',
        operationId: 'verifyDSARIdentity',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'Identity verified' },
        },
      },
    },
    '/dsar/{id}/complete': {
      post: {
        tags: ['DSAR'],
        summary: 'Complete DSAR',
        description: 'Mark a DSAR as completed',
        operationId: 'completeDSAR',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'DSAR completed' },
        },
      },
    },
    '/dsar/overdue': {
      get: {
        tags: ['DSAR'],
        summary: 'Get overdue DSARs',
        description: 'List DSARs that are past their deadline',
        operationId: 'getOverdueDSARs',
        responses: {
          '200': {
            description: 'List of overdue DSARs',
          },
        },
      },
    },

    // Breach Management
    '/breach': {
      post: {
        tags: ['Breach'],
        summary: 'Report breach',
        description: 'Report a new data breach (starts 72-hour notification clock)',
        operationId: 'reportBreach',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateBreachInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Breach reported',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DataBreach' },
              },
            },
          },
        },
      },
    },
    '/breach/{id}/notify-authority': {
      post: {
        tags: ['Breach'],
        summary: 'Notify authority',
        description: 'Record supervisory authority notification (GDPR Art. 33)',
        operationId: 'notifyAuthority',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'Authority notified' },
        },
      },
    },
    '/breach/{id}/notify-subjects': {
      post: {
        tags: ['Breach'],
        summary: 'Notify subjects',
        description: 'Record data subject notification (GDPR Art. 34)',
        operationId: 'notifySubjects',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'Subjects notified' },
        },
      },
    },
    '/breach/pending-notification': {
      get: {
        tags: ['Breach'],
        summary: 'Get pending notifications',
        description: 'List breaches pending authority notification',
        operationId: 'getPendingNotifications',
        responses: {
          '200': { description: 'Pending notifications' },
        },
      },
    },

    // DPIA
    '/dpia': {
      post: {
        tags: ['DPIA'],
        summary: 'Create DPIA',
        description: 'Create a new Data Protection Impact Assessment',
        operationId: 'createDPIA',
        responses: {
          '201': { description: 'DPIA created' },
        },
      },
    },
    '/dpia/{id}/risks': {
      post: {
        tags: ['DPIA'],
        summary: 'Add risk',
        description: 'Add an identified risk to the DPIA',
        operationId: 'addDPIARisk',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'Risk added' },
        },
      },
    },
    '/dpia/{id}/approve': {
      post: {
        tags: ['DPIA'],
        summary: 'Approve DPIA',
        description: 'Approve the DPIA (requires authority consultation if high residual risk)',
        operationId: 'approveDPIA',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'DPIA approved' },
          '400': { description: 'Cannot approve - authority consultation required' },
        },
      },
    },

    // Processing Activities
    '/activities': {
      post: {
        tags: ['Activities'],
        summary: 'Create activity',
        description: 'Create a new processing activity record (Art. 30)',
        operationId: 'createActivity',
        responses: {
          '201': { description: 'Activity created' },
        },
      },
      get: {
        tags: ['Activities'],
        summary: 'List activities',
        description: 'List processing activity records',
        operationId: 'listActivities',
        responses: {
          '200': { description: 'Activities list' },
        },
      },
    },
    '/activities/summary/{entityId}': {
      get: {
        tags: ['Activities'],
        summary: 'Get Art. 30 summary',
        description: 'Generate GDPR Article 30 summary report',
        operationId: 'getArticle30Summary',
        parameters: [
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Article 30 summary' },
        },
      },
    },

    // Processors
    '/processors': {
      post: {
        tags: ['Processors'],
        summary: 'Create processor',
        description: 'Register a new data processor (Art. 28)',
        operationId: 'createProcessor',
        responses: {
          '201': { description: 'Processor created' },
        },
      },
    },
    '/processors/{id}/dpa': {
      post: {
        tags: ['Processors'],
        summary: 'Record DPA',
        description: 'Record Data Processing Agreement details',
        operationId: 'recordDPA',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'DPA recorded' },
        },
      },
    },
    '/processors/{id}/risk': {
      get: {
        tags: ['Processors'],
        summary: 'Get compliance risk',
        description: 'Calculate processor compliance risk score',
        operationId: 'getProcessorRisk',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'Risk assessment' },
        },
      },
    },

    // Transfers
    '/transfers': {
      post: {
        tags: ['Transfers'],
        summary: 'Create transfer',
        description: 'Register a cross-border data transfer',
        operationId: 'createTransfer',
        responses: {
          '201': { description: 'Transfer created' },
        },
      },
    },
    '/transfers/{id}/impact-assessment': {
      post: {
        tags: ['Transfers'],
        summary: 'Record TIA',
        description: 'Record Transfer Impact Assessment (Schrems II requirement)',
        operationId: 'recordTIA',
        parameters: [{ $ref: '#/components/parameters/id' }],
        responses: {
          '200': { description: 'TIA recorded' },
        },
      },
    },
    '/transfers/recommend/{countryCode}': {
      get: {
        tags: ['Transfers'],
        summary: 'Get recommended basis',
        description: 'Get recommended transfer basis for a destination country',
        operationId: 'getRecommendedBasis',
        parameters: [
          { name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Recommended transfer basis' },
        },
      },
    },
    '/transfers/adequacy/{countryCode}': {
      get: {
        tags: ['Transfers'],
        summary: 'Check adequacy',
        description: 'Check if a country has an EU adequacy decision',
        operationId: 'checkAdequacy',
        parameters: [
          { name: 'countryCode', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Adequacy status' },
        },
      },
    },

    // Metrics
    '/metrics/program/{entityId}': {
      get: {
        tags: ['Metrics'],
        summary: 'Get program metrics',
        description: 'Get comprehensive privacy program metrics',
        operationId: 'getProgramMetrics',
        parameters: [
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Program metrics' },
        },
      },
    },
    '/metrics/dashboard/{entityId}': {
      get: {
        tags: ['Metrics'],
        summary: 'Get dashboard',
        description: 'Get compliance dashboard data',
        operationId: 'getDashboard',
        parameters: [
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Dashboard data' },
        },
      },
    },
    '/metrics/alerts/{entityId}': {
      get: {
        tags: ['Metrics'],
        summary: 'Get alerts',
        description: 'Get active compliance alerts',
        operationId: 'getAlerts',
        parameters: [
          { name: 'entityId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Active alerts' },
        },
      },
    },
  },
  components: {
    schemas: {
      ConsentRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'cuid' },
          entityId: { type: 'string' },
          subjectId: { type: 'string' },
          purpose: { type: 'string' },
          lawfulBasis: { type: 'string', enum: ['CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST'] },
          status: { type: 'string', enum: ['ACTIVE', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED'] },
          grantedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      GrantConsentInput: {
        type: 'object',
        required: ['entityId', 'subjectId', 'purpose', 'lawfulBasis'],
        properties: {
          entityId: { type: 'string' },
          subjectId: { type: 'string' },
          purpose: { type: 'string' },
          lawfulBasis: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      DSARRequest: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entityId: { type: 'string' },
          requestNumber: { type: 'string' },
          requestType: { type: 'string', enum: ['ACCESS', 'RECTIFICATION', 'ERASURE', 'PORTABILITY', 'RESTRICTION', 'OBJECTION'] },
          status: { type: 'string', enum: ['RECEIVED', 'PENDING_VERIFICATION', 'VERIFIED', 'PROCESSING', 'PENDING_REVIEW', 'COMPLETED', 'REJECTED', 'CLOSED'] },
          deadline: { type: 'string', format: 'date-time' },
          extendedDeadline: { type: 'string', format: 'date-time' },
          daysRemaining: { type: 'integer' },
          isOverdue: { type: 'boolean' },
        },
      },
      CreateDSARInput: {
        type: 'object',
        required: ['entityId', 'subjectEmail', 'requestType'],
        properties: {
          entityId: { type: 'string' },
          subjectEmail: { type: 'string', format: 'email' },
          requestType: { type: 'string' },
          description: { type: 'string' },
        },
      },
      DataBreach: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          breachNumber: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          status: { type: 'string', enum: ['IDENTIFIED', 'ASSESSING', 'CONTAINED', 'NOTIFYING', 'REMEDIATING', 'RESOLVED', 'CLOSED'] },
          notificationDeadline: { type: 'string', format: 'date-time' },
          hoursRemaining: { type: 'integer' },
          authorityNotificationRequired: { type: 'boolean' },
          authorityNotifiedAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateBreachInput: {
        type: 'object',
        required: ['entityId', 'title', 'description', 'severity', 'category', 'riskToSubjects'],
        properties: {
          entityId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string' },
          category: { type: 'string' },
          riskToSubjects: { type: 'string' },
          discoveredAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    parameters: {
      id: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'Resource ID',
      },
      entityId: {
        name: 'entityId',
        in: 'query',
        schema: { type: 'string' },
        description: 'Filter by entity ID',
      },
      limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 20, maximum: 100 },
        description: 'Maximum number of results',
      },
      offset: {
        name: 'offset',
        in: 'query',
        schema: { type: 'integer', default: 0 },
        description: 'Number of results to skip',
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request - validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', example: 'Not found' },
              },
            },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': { schema: { type: 'integer' } },
          'X-RateLimit-Remaining': { schema: { type: 'integer' } },
          'X-RateLimit-Reset': { schema: { type: 'integer' } },
          'Retry-After': { schema: { type: 'integer' } },
        },
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                retryAfter: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
} as const;
