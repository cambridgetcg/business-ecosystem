/**
 * Domain Client
 * HTTP client for calling operational domain service APIs
 */

import pino from 'pino';
import type { DomainClient, DomainActionRequest, DomainActionResult } from './types.js';

const logger = pino({ name: 'domain-client' });

export interface HttpDomainClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class HttpDomainClient implements DomainClient {
  private config: HttpDomainClientConfig;

  constructor(config: HttpDomainClientConfig) {
    this.config = config;
  }

  async execute(request: DomainActionRequest): Promise<DomainActionResult> {
    const url = `\${this.config.baseUrl}/actions/\${request.action}`;
    const timeout = request.timeout ?? this.config.timeout ?? 30000;

    logger.debug({
      domain: request.domain,
      action: request.action,
      url,
    }, 'Executing domain action');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': request.correlationId,
          ...this.config.headers,
        },
        body: JSON.stringify(request.input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({
          domain: request.domain,
          action: request.action,
          status: response.status,
          error: errorBody,
        }, 'Domain action failed');

        return {
          success: false,
          error: `HTTP \${response.status}: \${errorBody}`,
        };
      }

      const data = await response.json();

      logger.debug({
        domain: request.domain,
        action: request.action,
      }, 'Domain action succeeded');

      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({
        domain: request.domain,
        action: request.action,
        error: errorMessage,
      }, 'Domain action error');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`\${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this.config.headers,
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create domain clients for all operational domains
 */
export function createDomainClients(
  endpoints: Record<string, string>
): Map<string, DomainClient> {
  const clients = new Map<string, DomainClient>();

  for (const [domain, baseUrl] of Object.entries(endpoints)) {
    clients.set(domain, new HttpDomainClient({ baseUrl }));
  }

  return clients;
}

/**
 * Default operational domain endpoints for local development
 */
export const DEFAULT_DOMAIN_ENDPOINTS: Record<string, string> = {
  'contracts-legal': 'http://localhost:3011',
  'data-privacy': 'http://localhost:3012',
  'insurance': 'http://localhost:3013',
  'intellectual-property': 'http://localhost:3014',
  'operational': 'http://localhost:3020', // Orchestration events
};
