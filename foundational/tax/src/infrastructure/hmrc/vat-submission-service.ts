/**
 * VAT MTD Submission Service
 *
 * Handles the submission of VAT returns to HMRC via the Making Tax Digital API.
 */

import { HMRCApiClient, type VATReturnSubmission, type VATReturnResponse, HMRCApiError } from './api-client.js';
import type { UKVATReturn, VATBoxes } from '../../domain/vat/index.js';

// =============================================================================
// Types
// =============================================================================

export interface VATSubmissionResult {
  success: boolean;
  processingDate?: string;
  formBundleNumber?: string;
  paymentIndicator?: 'DD' | 'BANK';
  chargeRefNumber?: string;
  correlationId?: string;
  receiptId?: string;
  error?: {
    code: string;
    message: string;
    errors?: Array<{ code: string; message: string; path?: string }>;
  };
}

export interface VATObligationResult {
  obligations: Array<{
    periodKey: string;
    start: Date;
    end: Date;
    due: Date;
    status: 'open' | 'fulfilled';
    received?: Date;
  }>;
}

// =============================================================================
// Service
// =============================================================================

export class VATSubmissionService {
  constructor(
    private readonly apiClient: HMRCApiClient,
    private readonly logger?: {
      info: (msg: string, data?: object) => void;
      error: (msg: string, data?: object) => void;
    }
  ) {}

  /**
   * Submit a VAT return to HMRC
   */
  async submitReturn(
    entityId: string,
    vrn: string,
    vatReturn: UKVATReturn
  ): Promise<VATSubmissionResult> {
    // Validate return is ready for submission
    if (!vatReturn.declarationAccepted) {
      return {
        success: false,
        error: {
          code: 'DECLARATION_NOT_ACCEPTED',
          message: 'VAT return declaration must be accepted before submission',
        },
      };
    }

    if (vatReturn.status === 'submitted' || vatReturn.status === 'acknowledged') {
      return {
        success: false,
        error: {
          code: 'ALREADY_SUBMITTED',
          message: 'VAT return has already been submitted',
        },
      };
    }

    // Convert to HMRC format
    const submission = this.toHMRCFormat(vatReturn);

    this.logger?.info('Submitting VAT return to HMRC', {
      entityId,
      vrn,
      periodKey: submission.periodKey,
      netVatDue: submission.netVatDue,
    });

    try {
      const response = await this.apiClient.submitVATReturn(entityId, vrn, submission);

      this.logger?.info('VAT return submitted successfully', {
        entityId,
        periodKey: submission.periodKey,
        formBundleNumber: response.data.formBundleNumber,
        correlationId: response.headers.correlationId,
      });

      return {
        success: true,
        processingDate: response.data.processingDate,
        formBundleNumber: response.data.formBundleNumber,
        paymentIndicator: response.data.paymentIndicator,
        chargeRefNumber: response.data.chargeRefNumber,
        correlationId: response.headers.correlationId,
        receiptId: response.headers.receiptId,
      };
    } catch (error) {
      if (error instanceof HMRCApiError) {
        this.logger?.error('HMRC API error during VAT submission', {
          entityId,
          periodKey: submission.periodKey,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        });

        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            errors: error.errors,
          },
        };
      }

      this.logger?.error('Unexpected error during VAT submission', {
        entityId,
        periodKey: submission.periodKey,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
      };
    }
  }

  /**
   * Get VAT obligations from HMRC
   */
  async getObligations(
    entityId: string,
    vrn: string,
    params: { from?: Date; to?: Date; status?: 'open' | 'fulfilled' }
  ): Promise<VATObligationResult> {
    const apiParams: { from?: string; to?: string; status?: 'O' | 'F' } = {};

    if (params.from) {
      apiParams.from = params.from.toISOString().split('T')[0];
    }
    if (params.to) {
      apiParams.to = params.to.toISOString().split('T')[0];
    }
    if (params.status) {
      apiParams.status = params.status === 'open' ? 'O' : 'F';
    }

    const response = await this.apiClient.getVATObligations(entityId, vrn, apiParams);

    return {
      obligations: response.data.obligations.map(o => ({
        periodKey: o.periodKey,
        start: new Date(o.start),
        end: new Date(o.end),
        due: new Date(o.due),
        status: o.status === 'O' ? 'open' : 'fulfilled',
        received: o.received ? new Date(o.received) : undefined,
      })),
    };
  }

  /**
   * Retrieve a previously submitted VAT return
   */
  async getSubmittedReturn(
    entityId: string,
    vrn: string,
    periodKey: string
  ): Promise<{
    boxes: VATBoxes;
    processingDate: Date;
    finalised: boolean;
  }> {
    const response = await this.apiClient.getVATReturn(entityId, vrn, periodKey);

    return {
      boxes: {
        box1: response.data.vatDueSales.toFixed(2),
        box2: response.data.vatDueAcquisitions.toFixed(2),
        box3: response.data.totalVatDue.toFixed(2),
        box4: response.data.vatReclaimedCurrPeriod.toFixed(2),
        box5: response.data.netVatDue.toFixed(2),
        box6: response.data.totalValueSalesExVAT.toString(),
        box7: response.data.totalValuePurchasesExVAT.toString(),
        box8: response.data.totalValueGoodsSuppliedExVAT.toString(),
        box9: response.data.totalAcquisitionsExVAT.toString(),
      },
      processingDate: new Date(response.data.processingDate),
      finalised: response.data.finalised,
    };
  }

  /**
   * Convert internal VAT return format to HMRC submission format
   */
  private toHMRCFormat(vatReturn: UKVATReturn): VATReturnSubmission {
    return {
      periodKey: vatReturn.periodKey,
      vatDueSales: parseFloat(vatReturn.box1),
      vatDueAcquisitions: parseFloat(vatReturn.box2),
      totalVatDue: parseFloat(vatReturn.box3),
      vatReclaimedCurrPeriod: parseFloat(vatReturn.box4),
      netVatDue: Math.abs(parseFloat(vatReturn.box5)), // HMRC expects positive value
      totalValueSalesExVAT: parseInt(vatReturn.box6, 10),
      totalValuePurchasesExVAT: parseInt(vatReturn.box7, 10),
      totalValueGoodsSuppliedExVAT: parseInt(vatReturn.box8, 10),
      totalAcquisitionsExVAT: parseInt(vatReturn.box9, 10),
      finalised: true,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export interface VATSubmissionServiceDependencies {
  apiClient: HMRCApiClient;
  logger?: {
    info: (msg: string, data?: object) => void;
    error: (msg: string, data?: object) => void;
  };
}

export function createVATSubmissionService(
  deps: VATSubmissionServiceDependencies
): VATSubmissionService {
  return new VATSubmissionService(deps.apiClient, deps.logger);
}
