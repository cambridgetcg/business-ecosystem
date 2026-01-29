/**
 * Consolidated Banking View
 *
 * Unified view across all business units for treasury oversight.
 * Aggregates positions, facilities, relationships, and alerts.
 *
 * @module setup/templates
 */

import type { Money } from '../../../types/financial.js';
import type { BusinessUnitType } from '../../business/entities/business-unit.js';
import type { FacilityType } from '../../trade-finance/types.js';
import type { PaymentProcessorType } from '../../processors/types.js';
import type { RelationshipTier } from '../../relationships/types.js';

/**
 * Business unit cash summary.
 */
export interface BusinessUnitSummary {
  readonly businessUnitId: string;
  readonly name: string;
  readonly type: BusinessUnitType;
  readonly cashPosition: Money;
  readonly creditUtilization: number;
  readonly accountCount: number;
  readonly status: 'healthy' | 'attention' | 'critical';
}

/**
 * Currency position across entities.
 */
export interface CurrencyPosition {
  readonly currency: string;
  readonly nativeAmount: Money;
  readonly reportingAmount: Money;
  readonly fxRate: number;
  readonly percentageOfTotal: number;
}

/**
 * Bank position summary.
 */
export interface BankPosition {
  readonly bankRelationshipId: string;
  readonly bankName: string;
  readonly tier: RelationshipTier;
  readonly totalDeposits: Money;
  readonly totalCredit: Money;
  readonly accountCount: number;
}

/**
 * Facility summary by bank.
 */
export interface FacilityByBank {
  readonly bankRelationshipId: string;
  readonly bankName: string;
  readonly facilities: {
    readonly id: string;
    readonly type: FacilityType;
    readonly commitment: Money;
    readonly drawn: Money;
    readonly available: Money;
    readonly utilizationPercent: number;
  }[];
  readonly totalCommitment: Money;
  readonly totalDrawn: Money;
  readonly totalAvailable: Money;
}

/**
 * Processor balance summary.
 */
export interface ProcessorBalance {
  readonly processorConnectionId: string;
  readonly processorType: PaymentProcessorType;
  readonly businessUnitId: string;
  readonly pendingBalance: Money;
  readonly nextSettlementDate: Date;
  readonly nextSettlementAmount: Money;
}

/**
 * Relationships by tier.
 */
export interface RelationshipsByTier {
  readonly primary: BankRelationshipSummary[];
  readonly secondary: BankRelationshipSummary[];
  readonly specialist: BankRelationshipSummary[];
}

/**
 * Bank relationship summary.
 */
export interface BankRelationshipSummary {
  readonly id: string;
  readonly bankName: string;
  readonly products: string[];
  readonly estimatedAnnualRevenue: Money;
  readonly nextReviewDate?: Date | undefined;
  readonly relationshipScore: number;
}

/**
 * Alert types.
 */
export type ConsolidatedAlertType =
  | 'covenant_warning'
  | 'balance_low'
  | 'settlement_delay'
  | 'lc_expiring'
  | 'facility_expiring'
  | 'review_due'
  | 'fx_exposure'
  | 'concentration_risk';

/**
 * Consolidated alert.
 */
export interface ConsolidatedAlert {
  readonly type: ConsolidatedAlertType;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly businessUnitId?: string | undefined;
  readonly entityId?: string | undefined;
  readonly message: string;
  readonly actionRequired?: string | undefined;
  readonly dueDate?: Date | undefined;
}

/**
 * Consolidated Banking View
 */
export interface ConsolidatedBankingView {
  readonly generatedAt: Date;
  readonly reportingCurrency: string;

  /** Business unit summaries */
  readonly businessUnits: BusinessUnitSummary[];

  /** Consolidated position */
  readonly totalCashPosition: Money;
  readonly positionByCurrency: CurrencyPosition[];
  readonly positionByBank: BankPosition[];

  /** Credit overview */
  readonly totalCreditCommitment: Money;
  readonly totalCreditDrawn: Money;
  readonly totalCreditAvailable: Money;
  readonly creditUtilizationPercent: number;
  readonly facilitiesByBank: FacilityByBank[];

  /** Processor overview */
  readonly processorBalances: ProcessorBalance[];
  readonly totalPendingSettlements: Money;

  /** Relationship overview */
  readonly relationshipsByTier: RelationshipsByTier;
  readonly totalBankRelationships: number;

  /** Trade finance overview */
  readonly openLettersOfCredit: number;
  readonly totalLCExposure: Money;

  /** Risk indicators */
  readonly concentrationRisk: {
    readonly topBank: string;
    readonly percentageWithTopBank: number;
    readonly isConcentrated: boolean;
  };
  readonly fxExposure: {
    readonly currency: string;
    readonly netExposure: Money;
    readonly hedgedPercent: number;
  }[];

  /** Alerts and actions */
  readonly alerts: ConsolidatedAlert[];
  readonly upcomingActions: {
    readonly action: string;
    readonly dueDate: Date;
    readonly relatedEntity: string;
  }[];
}

/**
 * Create an empty consolidated view structure.
 */
export function createEmptyConsolidatedView(reportingCurrency: string): ConsolidatedBankingView {
  return {
    generatedAt: new Date(),
    reportingCurrency,
    businessUnits: [],
    totalCashPosition: { amount: 0, currency: reportingCurrency },
    positionByCurrency: [],
    positionByBank: [],
    totalCreditCommitment: { amount: 0, currency: reportingCurrency },
    totalCreditDrawn: { amount: 0, currency: reportingCurrency },
    totalCreditAvailable: { amount: 0, currency: reportingCurrency },
    creditUtilizationPercent: 0,
    facilitiesByBank: [],
    processorBalances: [],
    totalPendingSettlements: { amount: 0, currency: reportingCurrency },
    relationshipsByTier: { primary: [], secondary: [], specialist: [] },
    totalBankRelationships: 0,
    openLettersOfCredit: 0,
    totalLCExposure: { amount: 0, currency: reportingCurrency },
    concentrationRisk: {
      topBank: '',
      percentageWithTopBank: 0,
      isConcentrated: false,
    },
    fxExposure: [],
    alerts: [],
    upcomingActions: [],
  };
}

/**
 * Generate alerts based on consolidated view data.
 */
export function generateAlerts(view: ConsolidatedBankingView): ConsolidatedAlert[] {
  const alerts: ConsolidatedAlert[] = [];

  // Credit utilization warning
  if (view.creditUtilizationPercent > 80) {
    alerts.push({
      type: 'covenant_warning',
      severity: view.creditUtilizationPercent > 90 ? 'critical' : 'warning',
      message: `Credit utilization at ${view.creditUtilizationPercent.toFixed(1)}%`,
      actionRequired: 'Review credit facilities and consider paydown or expansion',
    });
  }

  // Concentration risk warning
  if (view.concentrationRisk.isConcentrated) {
    alerts.push({
      type: 'concentration_risk',
      severity: view.concentrationRisk.percentageWithTopBank > 70 ? 'critical' : 'warning',
      message: `${view.concentrationRisk.percentageWithTopBank.toFixed(1)}% of deposits with ${view.concentrationRisk.topBank}`,
      actionRequired: 'Consider diversifying bank relationships',
    });
  }

  // FX exposure warnings
  for (const exposure of view.fxExposure) {
    if (exposure.hedgedPercent < 50 && exposure.netExposure.amount > 100000) {
      alerts.push({
        type: 'fx_exposure',
        severity: 'warning',
        message: `Unhedged ${exposure.currency} exposure: ${exposure.netExposure.amount.toLocaleString()} (${exposure.hedgedPercent}% hedged)`,
        actionRequired: 'Consider forward contracts or options for hedging',
      });
    }
  }

  // Business unit health alerts
  for (const unit of view.businessUnits) {
    if (unit.status === 'critical') {
      alerts.push({
        type: 'balance_low',
        severity: 'critical',
        businessUnitId: unit.businessUnitId,
        message: `${unit.name}: Critical status - immediate attention required`,
        actionRequired: 'Review cash position and upcoming obligations',
      });
    }
  }

  return alerts;
}

/**
 * Calculate concentration risk.
 */
export function calculateConcentrationRisk(
  positionByBank: BankPosition[],
  totalCash: number
): { topBank: string; percentageWithTopBank: number; isConcentrated: boolean } {
  if (positionByBank.length === 0 || totalCash === 0) {
    return { topBank: '', percentageWithTopBank: 0, isConcentrated: false };
  }

  const sorted = [...positionByBank].sort(
    (a, b) => b.totalDeposits.amount - a.totalDeposits.amount
  );

  const topBank = sorted[0];
  if (!topBank) {
    return { topBank: '', percentageWithTopBank: 0, isConcentrated: false };
  }
  const percentage = (topBank.totalDeposits.amount / totalCash) * 100;

  return {
    topBank: topBank.bankName,
    percentageWithTopBank: percentage,
    isConcentrated: percentage > 50, // More than 50% with one bank is concentrated
  };
}
