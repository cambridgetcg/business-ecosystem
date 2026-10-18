/**
 * HMRC API Client
 *
 * HTTP client for HMRC Making Tax Digital APIs.
 * Reference: https://developer.service.hmrc.gov.uk/api-documentation
 */

import { z } from 'zod';
import { HMRCOAuthClient, type HMRCTokenSet, type HMRCTokenStore, HMRCAuthError } from './oauth-client.js';

// =============================================================================
// Configuration
// =============================================================================

export interface HMRCApiClientConfig {
  oauthClient: HMRCOAuthClient;
  tokenStore: HMRCTokenStore;
  environment: 'sandbox' | 'production';
  fraudPreventionHeaders?: FraudPreventionHeaders;
}

// =============================================================================
// Fraud Prevention Headers (Required for production)
// =============================================================================

export interface FraudPreventionHeaders {
  govClientConnectionMethod: 'DESKTOP_APP_DIRECT' | 'WEB_APP_VIA_SERVER' | 'MOBILE_APP_DIRECT' | 'OTHER_DIRECT';
  govClientPublicIp?: string;
  govClientPublicPort?: string;
  govClientDeviceId?: string;
  govClientUserId?: string;
  govClientTimezone?: string;
  govClientLocalIps?: string;
  govClientScreens?: string;
  govClientWindowSize?: string;
  govClientBrowserPlugins?: string;
  govClientBrowserJsUserAgent?: string;
  govClientBrowserDoNotTrack?: boolean;
  govClientMultiFactor?: string;
  govVendorVersion?: string;
  govVendorProductName?: string;
  govVendorLicenseIds?: string;
  govVendorPublicIp?: string;
  govVendorForwardedFor?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class HMRCApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly errors?: Array<{ code: string; message: string; path?: string }>
  ) {
    super(message);
    this.name = 'HMRCApiError';
  }
}

// =============================================================================
// Response Types
// =============================================================================

export interface HMRCApiResponse<T> {
  data: T;
  headers: {
    correlationId?: string;
    receiptId?: string;
    receiptTimestamp?: string;
  };
}

// =============================================================================
// VAT Types
// =============================================================================

export const VATObligationSchema = z.object({
  periodKey: z.string(),
  start: z.string(),
  end: z.string(),
  due: z.string(),
  status: z.enum(['O', 'F']), // O = Open, F = Fulfilled
  received: z.string().optional(),
});

export type VATObligation = z.infer<typeof VATObligationSchema>;

export const VATReturnSubmissionSchema = z.object({
  periodKey: z.string(),
  vatDueSales: z.number(),
  vatDueAcquisitions: z.number(),
  totalVatDue: z.number(),
  vatReclaimedCurrPeriod: z.number(),
  netVatDue: z.number(),
  totalValueSalesExVAT: z.number().int(),
  totalValuePurchasesExVAT: z.number().int(),
  totalValueGoodsSuppliedExVAT: z.number().int(),
  totalAcquisitionsExVAT: z.number().int(),
  finalised: z.boolean(),
});

export type VATReturnSubmission = z.infer<typeof VATReturnSubmissionSchema>;

export interface VATReturnResponse {
  processingDate: string;
  paymentIndicator?: 'DD' | 'BANK';
  formBundleNumber: string;
  chargeRefNumber?: string;
}

// =============================================================================
// API Client
// =============================================================================

export class HMRCApiClient {
  private readonly baseUrl: string;
  private readonly config: HMRCApiClientConfig;

  constructor(config: HMRCApiClientConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.service.hmrc.gov.uk'
      : 'https://test-api.service.hmrc.gov.uk';
  }

  // ===========================================================================
  // VAT API Methods
  // ===========================================================================

  /**
   * Get VAT obligations for a VRN
   */
  async getVATObligations(
    entityId: string,
    vrn: string,
    params: { from?: string; to?: string; status?: 'O' | 'F' }
  ): Promise<HMRCApiResponse<{ obligations: VATObligation[] }>> {
    const queryParams = new URLSearchParams();
    if (params.from) queryParams.set('from', params.from);
    if (params.to) queryParams.set('to', params.to);
    if (params.status) queryParams.set('status', params.status);

    return this.request<{ obligations: VATObligation[] }>(
      entityId,
      'read:vat',
      'GET',
      `/organisations/vat/${vrn}/obligations?${queryParams.toString()}`
    );
  }

  /**
   * Submit a VAT return
   */
  async submitVATReturn(
    entityId: string,
    vrn: string,
    submission: VATReturnSubmission
  ): Promise<HMRCApiResponse<VATReturnResponse>> {
    // Validate submission
    VATReturnSubmissionSchema.parse(submission);

    return this.request<VATReturnResponse>(
      entityId,
      'write:vat',
      'POST',
      `/organisations/vat/${vrn}/returns`,
      submission
    );
  }

  /**
   * View a submitted VAT return
   */
  async getVATReturn(
    entityId: string,
    vrn: string,
    periodKey: string
  ): Promise<HMRCApiResponse<VATReturnSubmission & { processingDate: string }>> {
    return this.request<VATReturnSubmission & { processingDate: string }>(
      entityId,
      'read:vat',
      'GET',
      `/organisations/vat/${vrn}/returns/${periodKey}`
    );
  }

  /**
   * Get VAT liabilities
   */
  async getVATLiabilities(
    entityId: string,
    vrn: string,
    from: string,
    to: string
  ): Promise<HMRCApiResponse<{ liabilities: Array<{
    taxPeriod: { from: string; to: string };
    type: string;
    originalAmount: number;
    outstandingAmount: number;
    due: string;
  }> }>> {
    return this.request(
      entityId,
      'read:vat',
      'GET',
      `/organisations/vat/${vrn}/liabilities?from=${from}&to=${to}`
    );
  }

  /**
   * Get VAT payments
   */
  async getVATPayments(
    entityId: string,
    vrn: string,
    from: string,
    to: string
  ): Promise<HMRCApiResponse<{ payments: Array<{
    amount: number;
    received: string;
  }> }>> {
    return this.request(
      entityId,
      'read:vat',
      'GET',
      `/organisations/vat/${vrn}/payments?from=${from}&to=${to}`
    );
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async request<T>(
    entityId: string,
    scope: string,
    method: string,
    path: string,
    body?: unknown
  ): Promise<HMRCApiResponse<T>> {
    // Get valid token
    let tokenSet = await this.config.tokenStore.getToken(entityId, scope);
    if (!tokenSet) {
      throw new HMRCAuthError(
        'No HMRC authorization found. User must authorize first.',
        'not_authorized'
      );
    }

    // Refresh if expired
    if (this.config.oauthClient.isTokenExpired(tokenSet)) {
      tokenSet = await this.config.oauthClient.refreshToken(tokenSet.refreshToken);
      await this.config.tokenStore.saveToken(entityId, scope, tokenSet);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${tokenSet.accessToken}`,
      'Accept': 'application/vnd.hmrc.1.0+json',
      'Content-Type': 'application/json',
    };

    // Add fraud prevention headers if configured
    if (this.config.fraudPreventionHeaders) {
      this.addFraudPreventionHeaders(headers, this.config.fraudPreventionHeaders);
    }

    // Make request
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Parse response
    const responseHeaders = {
      correlationId: response.headers.get('X-CorrelationId') ?? undefined,
      receiptId: response.headers.get('Receipt-ID') ?? undefined,
      receiptTimestamp: response.headers.get('Receipt-Timestamp') ?? undefined,
    };

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new HMRCApiError(
        errorBody.message || `HMRC API error: ${response.status}`,
        errorBody.code || 'api_error',
        response.status,
        errorBody.errors
      );
    }

    const data = await response.json() as T;
    return { data, headers: responseHeaders };
  }

  private addFraudPreventionHeaders(
    headers: Record<string, string>,
    fpHeaders: FraudPreventionHeaders
  ): void {
    headers['Gov-Client-Connection-Method'] = fpHeaders.govClientConnectionMethod;

    if (fpHeaders.govClientPublicIp) {
      headers['Gov-Client-Public-IP'] = fpHeaders.govClientPublicIp;
    }
    if (fpHeaders.govClientPublicPort) {
      headers['Gov-Client-Public-Port'] = fpHeaders.govClientPublicPort;
    }
    if (fpHeaders.govClientDeviceId) {
      headers['Gov-Client-Device-ID'] = fpHeaders.govClientDeviceId;
    }
    if (fpHeaders.govClientUserId) {
      headers['Gov-Client-User-IDs'] = fpHeaders.govClientUserId;
    }
    if (fpHeaders.govClientTimezone) {
      headers['Gov-Client-Timezone'] = fpHeaders.govClientTimezone;
    }
    if (fpHeaders.govClientLocalIps) {
      headers['Gov-Client-Local-IPs'] = fpHeaders.govClientLocalIps;
    }
    if (fpHeaders.govClientScreens) {
      headers['Gov-Client-Screens'] = fpHeaders.govClientScreens;
    }
    if (fpHeaders.govClientWindowSize) {
      headers['Gov-Client-Window-Size'] = fpHeaders.govClientWindowSize;
    }
    if (fpHeaders.govVendorVersion) {
      headers['Gov-Vendor-Version'] = fpHeaders.govVendorVersion;
    }
    if (fpHeaders.govVendorProductName) {
      headers['Gov-Vendor-Product-Name'] = fpHeaders.govVendorProductName;
    }
    if (fpHeaders.govVendorLicenseIds) {
      headers['Gov-Vendor-License-IDs'] = fpHeaders.govVendorLicenseIds;
    }
    if (fpHeaders.govVendorPublicIp) {
      headers['Gov-Vendor-Public-IP'] = fpHeaders.govVendorPublicIp;
    }
    if (fpHeaders.govVendorForwardedFor) {
      headers['Gov-Vendor-Forwarded'] = fpHeaders.govVendorForwardedFor;
    }
  }
}
