/**
 * DocuSign Adapter
 * E-signature integration with DocuSign eSignature API
 *
 * Capabilities:
 * - Create and send envelopes for signature
 * - Track envelope status
 * - Download completed documents
 * - Webhook handling for real-time updates
 */

import { z } from 'zod';
import { BaseExternalAdapter, ExternalAdapterError } from '../base-adapter.js';
import type {
  OAuthCredentials,
  ExternalConnection,
  CreateEnvelopeRequest,
  EnvelopeStatus,
  CompletedDocument,
  RecipientStatus,
  WebhookEvent,
} from '../types.js';

// =============================================================================
// DocuSign-Specific Types
// =============================================================================

export type DocuSignEnvironment = 'demo' | 'production';

export interface DocuSignConfig {
  environment: DocuSignEnvironment;
  accountId: string;
  integrationKey: string;  // Client ID
  secretKey: string;       // Client Secret
  privateKey?: string;     // For JWT auth
  userId?: string;         // For JWT auth
}

export interface DocuSignCredentials extends OAuthCredentials {
  accountId: string;
  environment: DocuSignEnvironment;
}

export interface DocuSignEnvelope {
  envelopeId: string;
  uri: string;
  status: string;
  statusChangedDateTime: string;
}

export interface DocuSignTemplate {
  templateId: string;
  name: string;
  description?: string;
  shared: boolean;
  created: string;
  lastModified: string;
}

export interface EmbeddedSigningUrl {
  url: string;
  expiresAfter: number;  // seconds
}

// =============================================================================
// Schema Validation
// =============================================================================

const DocuSignConfigSchema = z.object({
  environment: z.enum(['demo', 'production']),
  accountId: z.string().min(1),
  integrationKey: z.string().min(1),
  secretKey: z.string().min(1),
  privateKey: z.string().optional(),
  userId: z.string().optional(),
});

// =============================================================================
// DocuSign Adapter Implementation
// =============================================================================

export class DocuSignAdapter extends BaseExternalAdapter<DocuSignCredentials> {
  readonly provider = 'docusign' as const;

  private config: DocuSignConfig;

  constructor(config: DocuSignConfig) {
    super();
    this.config = DocuSignConfigSchema.parse(config);
  }

  protected getBaseUrl(): string {
    const base = this.config.environment === 'demo'
      ? 'https://demo.docusign.net'
      : 'https://www.docusign.net';
    return `${base}/restapi/v2.1/accounts/${this.config.accountId}`;
  }

  private getAuthUrl(): string {
    return this.config.environment === 'demo'
      ? 'https://account-d.docusign.com'
      : 'https://account.docusign.com';
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Connect using OAuth authorization code flow
   */
  async connect(credentials: DocuSignCredentials): Promise<ExternalConnection> {
    const connectionId = this.generateConnectionId(
      credentials.accountId,
      credentials.environment
    );

    // Verify token is valid
    if (!credentials.accessToken) {
      throw new ExternalAdapterError(
        'Access token required',
        'docusign',
        'INVALID_CREDENTIALS'
      );
    }

    this.credentials.set(connectionId, credentials);

    const connection: ExternalConnection = {
      id: connectionId,
      provider: 'docusign',
      status: 'connected',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: credentials.tokenExpiresAt,
      metadata: {
        accountId: credentials.accountId,
        environment: credentials.environment,
      },
    };

    this.connections.set(connectionId, connection);

    // Verify connection
    await this.performHealthCheck(connectionId);

    this.log.info({ connectionId, accountId: credentials.accountId }, 'Connected to DocuSign');

    return connection;
  }

  protected async performHealthCheck(connectionId: string): Promise<void> {
    // Check account info endpoint
    await this.request<{ accountId: string }>(connectionId, 'GET', '');
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshCredentials(connectionId: string): Promise<void> {
    const creds = this.credentials.get(connectionId);
    if (!creds || creds.type !== 'oauth') {
      throw new ExternalAdapterError(
        'No OAuth credentials found',
        'docusign',
        'NO_CREDENTIALS'
      );
    }

    if (!creds.refreshToken) {
      throw new ExternalAdapterError(
        'No refresh token available',
        'docusign',
        'NO_REFRESH_TOKEN'
      );
    }

    const authUrl = `${this.getAuthUrl()}/oauth/token`;
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.config.integrationKey}:${this.config.secretKey}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ExternalAdapterError(
        `Token refresh failed: ${error}`,
        'docusign',
        'TOKEN_REFRESH_FAILED',
        response.status
      );
    }

    const tokens = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Update credentials
    this.credentials.set(connectionId, {
      ...creds,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    this.log.info({ connectionId }, 'DocuSign tokens refreshed');
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      scope: 'signature impersonation',
      client_id: this.config.integrationKey,
      redirect_uri: redirectUri,
      state,
    });

    return `${this.getAuthUrl()}/oauth/auth?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<DocuSignCredentials> {
    const authUrl = `${this.getAuthUrl()}/oauth/token`;

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.config.integrationKey}:${this.config.secretKey}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ExternalAdapterError(
        `Token exchange failed: ${error}`,
        'docusign',
        'TOKEN_EXCHANGE_FAILED',
        response.status
      );
    }

    const tokens = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      type: 'oauth',
      clientId: this.config.integrationKey,
      clientSecret: this.config.secretKey,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      accountId: this.config.accountId,
      environment: this.config.environment,
      scopes: ['signature', 'impersonation'],
    };
  }

  // ==========================================================================
  // ENVELOPE OPERATIONS
  // ==========================================================================

  /**
   * Create and send an envelope
   */
  async createEnvelope(
    connectionId: string,
    request: CreateEnvelopeRequest
  ): Promise<DocuSignEnvelope> {
    const body = this.buildEnvelopeDefinition(request);

    const result = await this.request<DocuSignEnvelope>(
      connectionId,
      'POST',
      '/envelopes',
      { body }
    );

    this.log.info({
      connectionId,
      envelopeId: result.envelopeId,
      recipientCount: request.recipients.length,
    }, 'Envelope created');

    return result;
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(
    connectionId: string,
    envelopeId: string
  ): Promise<EnvelopeStatus> {
    const result = await this.request<{
      envelopeId: string;
      status: string;
      statusChangedDateTime: string;
      sentDateTime?: string;
      completedDateTime?: string;
      declinedDateTime?: string;
      voidedDateTime?: string;
      recipients: {
        signers?: Array<{
          email: string;
          name: string;
          status: string;
          signedDateTime?: string;
          declinedDateTime?: string;
          declinedReason?: string;
        }>;
        carbonCopies?: Array<{
          email: string;
          name: string;
          status: string;
        }>;
      };
    }>(connectionId, 'GET', `/envelopes/${envelopeId}`);

    const recipients: RecipientStatus[] = [];

    if (result.recipients.signers) {
      for (const signer of result.recipients.signers) {
        recipients.push({
          email: signer.email,
          name: signer.name,
          status: this.mapRecipientStatus(signer.status),
          signedAt: signer.signedDateTime ? new Date(signer.signedDateTime) : undefined,
          declinedAt: signer.declinedDateTime ? new Date(signer.declinedDateTime) : undefined,
          declineReason: signer.declinedReason,
        });
      }
    }

    if (result.recipients.carbonCopies) {
      for (const cc of result.recipients.carbonCopies) {
        recipients.push({
          email: cc.email,
          name: cc.name,
          status: this.mapRecipientStatus(cc.status),
        });
      }
    }

    return {
      envelopeId: result.envelopeId,
      status: this.mapEnvelopeStatus(result.status),
      statusChangedAt: new Date(result.statusChangedDateTime),
      sentAt: result.sentDateTime ? new Date(result.sentDateTime) : undefined,
      completedAt: result.completedDateTime ? new Date(result.completedDateTime) : undefined,
      declinedAt: result.declinedDateTime ? new Date(result.declinedDateTime) : undefined,
      voidedAt: result.voidedDateTime ? new Date(result.voidedDateTime) : undefined,
      recipients,
    };
  }

  /**
   * List envelopes with filters
   */
  async listEnvelopes(
    connectionId: string,
    options?: {
      fromDate?: Date;
      toDate?: Date;
      status?: string;
      count?: number;
      startPosition?: number;
    }
  ): Promise<{ envelopes: DocuSignEnvelope[]; totalSetSize: number }> {
    const query: Record<string, string | number> = {};

    if (options?.fromDate) {
      query['from_date'] = options.fromDate.toISOString();
    }
    if (options?.toDate) {
      query['to_date'] = options.toDate.toISOString();
    }
    if (options?.status) {
      query['status'] = options.status;
    }
    if (options?.count) {
      query['count'] = options.count;
    }
    if (options?.startPosition) {
      query['start_position'] = options.startPosition;
    }

    return this.request<{ envelopes: DocuSignEnvelope[]; totalSetSize: number }>(
      connectionId,
      'GET',
      '/envelopes',
      { query }
    );
  }

  /**
   * Void an envelope
   */
  async voidEnvelope(
    connectionId: string,
    envelopeId: string,
    reason: string
  ): Promise<void> {
    await this.request(connectionId, 'PUT', `/envelopes/${envelopeId}`, {
      body: {
        status: 'voided',
        voidedReason: reason,
      },
    });

    this.log.info({ connectionId, envelopeId, reason }, 'Envelope voided');
  }

  /**
   * Resend envelope
   */
  async resendEnvelope(connectionId: string, envelopeId: string): Promise<void> {
    await this.request(connectionId, 'PUT', `/envelopes/${envelopeId}?resend_envelope=true`, {
      body: {},
    });

    this.log.info({ connectionId, envelopeId }, 'Envelope resent');
  }

  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================

  /**
   * Download completed documents
   */
  async downloadDocuments(
    connectionId: string,
    envelopeId: string
  ): Promise<CompletedDocument[]> {
    const result = await this.request<{
      envelopeDocuments: Array<{
        documentId: string;
        name: string;
        uri: string;
      }>;
    }>(connectionId, 'GET', `/envelopes/${envelopeId}/documents`);

    return result.envelopeDocuments.map(doc => ({
      documentId: doc.documentId,
      name: doc.name,
      downloadUrl: `${this.getBaseUrl()}/envelopes/${envelopeId}/documents/${doc.documentId}`,
    }));
  }

  /**
   * Get document content
   */
  async getDocumentContent(
    connectionId: string,
    envelopeId: string,
    documentId: string
  ): Promise<Buffer> {
    const creds = this.credentials.get(connectionId);
    if (!creds?.accessToken) {
      throw new ExternalAdapterError(
        'No credentials found',
        'docusign',
        'NO_CREDENTIALS'
      );
    }

    const url = `${this.getBaseUrl()}/envelopes/${envelopeId}/documents/${documentId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new ExternalAdapterError(
        `Failed to download document: ${response.statusText}`,
        'docusign',
        'DOWNLOAD_FAILED',
        response.status
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Get combined PDF (certificate + all documents)
   */
  async getCombinedDocument(
    connectionId: string,
    envelopeId: string
  ): Promise<Buffer> {
    return this.getDocumentContent(connectionId, envelopeId, 'combined');
  }

  // ==========================================================================
  // EMBEDDED SIGNING
  // ==========================================================================

  /**
   * Create embedded signing URL
   */
  async getEmbeddedSigningUrl(
    connectionId: string,
    envelopeId: string,
    returnUrl: string,
    recipientEmail: string,
    recipientName: string,
    clientUserId?: string
  ): Promise<EmbeddedSigningUrl> {
    const result = await this.request<{
      url: string;
    }>(connectionId, 'POST', `/envelopes/${envelopeId}/views/recipient`, {
      body: {
        returnUrl,
        authenticationMethod: 'none',
        email: recipientEmail,
        userName: recipientName,
        clientUserId: clientUserId || recipientEmail,
      },
    });

    return {
      url: result.url,
      expiresAfter: 300, // DocuSign URLs expire after 5 minutes
    };
  }

  // ==========================================================================
  // TEMPLATE OPERATIONS
  // ==========================================================================

  /**
   * List available templates
   */
  async listTemplates(
    connectionId: string,
    options?: { count?: number; startPosition?: number }
  ): Promise<{ templates: DocuSignTemplate[]; totalSetSize: number }> {
    const query: Record<string, number> = {};
    if (options?.count) query['count'] = options.count;
    if (options?.startPosition) query['start_position'] = options.startPosition;

    return this.request<{ templates: DocuSignTemplate[]; totalSetSize: number }>(
      connectionId,
      'GET',
      '/templates',
      { query }
    );
  }

  /**
   * Get template details
   */
  async getTemplate(
    connectionId: string,
    templateId: string
  ): Promise<DocuSignTemplate> {
    return this.request<DocuSignTemplate>(
      connectionId,
      'GET',
      `/templates/${templateId}`
    );
  }

  // ==========================================================================
  // WEBHOOK HANDLING
  // ==========================================================================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: string): WebhookEvent {
    const data = JSON.parse(payload);
    const envelope = data.envelopeId ? {
      envelopeId: data.envelopeId,
      status: data.status,
    } : undefined;

    return {
      id: data.event || 'unknown',
      provider: 'docusign',
      eventType: data.event || 'envelope-status-change',
      payload: {
        envelope,
        recipients: data.recipients,
        timestamp: data.generatedDateTime,
      },
      receivedAt: new Date(),
      status: 'pending',
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private buildEnvelopeDefinition(request: CreateEnvelopeRequest): unknown {
    const definition: Record<string, unknown> = {
      emailSubject: request.subject,
      status: 'sent', // Send immediately
    };

    if (request.message) {
      definition['emailBlurb'] = request.message;
    }

    // Handle template-based or document-based envelope
    if (request.templateId) {
      definition['templateId'] = request.templateId;
      definition['templateRoles'] = request.recipients.map(r => ({
        email: r.email,
        name: r.name,
        roleName: r.role,
        routingOrder: r.routingOrder || r.order,
      }));
    } else {
      // Build recipients
      const signers = request.recipients
        .filter(r => r.recipientType === 'signer' || r.recipientType === 'in_person_signer')
        .map((r, i) => ({
          email: r.email,
          name: r.name,
          recipientId: String(i + 1),
          routingOrder: r.routingOrder || r.order || i + 1,
          tabs: r.tabs ? this.buildTabs(r.tabs) : undefined,
        }));

      const carbonCopies = request.recipients
        .filter(r => r.recipientType === 'cc')
        .map((r, i) => ({
          email: r.email,
          name: r.name,
          recipientId: String(100 + i),
          routingOrder: r.routingOrder || 100,
        }));

      definition['recipients'] = {
        signers,
        carbonCopies,
      };

      // Add documents
      if (request.documents?.length) {
        definition['documents'] = request.documents.map((doc, i) => ({
          documentId: doc.documentId || String(i + 1),
          name: doc.name,
          fileExtension: doc.fileExtension,
          documentBase64: doc.documentBase64,
        }));
      }
    }

    // Custom fields
    if (request.customFields) {
      definition['customFields'] = {
        textCustomFields: Object.entries(request.customFields).map(([name, value]) => ({
          name,
          value,
          show: 'false',
        })),
      };
    }

    // Notification settings
    if (request.reminderEnabled) {
      definition['notification'] = {
        useAccountDefaults: 'false',
        reminders: {
          reminderEnabled: 'true',
          reminderDelay: request.reminderDelayDays?.toString() || '1',
          reminderFrequency: request.reminderFrequencyDays?.toString() || '1',
        },
        expirations: request.expiresInDays ? {
          expireEnabled: 'true',
          expireAfter: request.expiresInDays.toString(),
          expireWarn: '3',
        } : undefined,
      };
    }

    return definition;
  }

  private buildTabs(tabs: CreateEnvelopeRequest['recipients'][0]['tabs']): unknown {
    if (!tabs) return undefined;

    const result: Record<string, unknown[]> = {
      signHereTabs: [],
      initialHereTabs: [],
      dateSignedTabs: [],
      textTabs: [],
      checkboxTabs: [],
    };

    for (const tab of tabs) {
      const tabData = {
        documentId: tab.documentId,
        pageNumber: tab.pageNumber.toString(),
        xPosition: tab.xPosition.toString(),
        yPosition: tab.yPosition.toString(),
        width: tab.width?.toString(),
        height: tab.height?.toString(),
        required: tab.required !== false ? 'true' : 'false',
        tabLabel: tab.label,
      };

      switch (tab.type) {
        case 'signature':
          result['signHereTabs'].push(tabData);
          break;
        case 'initial':
          result['initialHereTabs'].push(tabData);
          break;
        case 'date_signed':
          result['dateSignedTabs'].push(tabData);
          break;
        case 'text':
          result['textTabs'].push(tabData);
          break;
        case 'checkbox':
          result['checkboxTabs'].push(tabData);
          break;
      }
    }

    return result;
  }

  private mapEnvelopeStatus(status: string): EnvelopeStatus['status'] {
    const mapping: Record<string, EnvelopeStatus['status']> = {
      'created': 'created',
      'sent': 'sent',
      'delivered': 'delivered',
      'signed': 'signed',
      'completed': 'completed',
      'declined': 'declined',
      'voided': 'voided',
    };
    return mapping[status.toLowerCase()] || 'created';
  }

  private mapRecipientStatus(status: string): RecipientStatus['status'] {
    const mapping: Record<string, RecipientStatus['status']> = {
      'created': 'created',
      'sent': 'sent',
      'delivered': 'delivered',
      'signed': 'signed',
      'declined': 'declined',
      'completed': 'completed',
    };
    return mapping[status.toLowerCase()] || 'created';
  }
}

/**
 * Create DocuSign adapter factory
 */
export function createDocuSignAdapter(config: DocuSignConfig): DocuSignAdapter {
  return new DocuSignAdapter(config);
}
