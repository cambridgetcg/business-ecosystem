/**
 * Tax Provision Calculator Service
 *
 * Calculates tax provisions for financial reporting including:
 * - Current tax charge
 * - Deferred tax movements
 * - Effective tax rate reconciliation
 */

import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import {
  type TaxProvision,
  type TaxProvisionInput,
  type CurrentTaxProvision,
  type DeferredTaxProvision,
  type DeferredTaxItem,
  type TaxRateReconciliation,
} from '../models/provision.js';

// Configure Decimal.js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// =============================================================================
// Tax Rates
// =============================================================================

export const TaxProvisionRates = {
  // UK Corporation Tax rates
  UK_MAIN_RATE_2024: 0.25, // 25% from April 2023
  UK_SMALL_PROFITS_RATE: 0.19, // 19% for small profits

  // Deferred tax rate (use substantively enacted rate)
  UK_DEFERRED_TAX_RATE: 0.25,

  // Thresholds
  SMALL_PROFITS_LIMIT: 50000,
  UPPER_LIMIT: 250000,
} as const;

// =============================================================================
// Tax Provision Calculator
// =============================================================================

export class TaxProvisionCalculator {
  /**
   * Calculate complete tax provision
   */
  calculateProvision(input: TaxProvisionInput): TaxProvision {
    const now = new Date();
    const taxRate = new Decimal(input.taxRate || TaxProvisionRates.UK_MAIN_RATE_2024);

    // Calculate current tax
    const currentTax = this.calculateCurrentTax(input, taxRate);

    // Calculate deferred tax
    const deferredTax = this.calculateDeferredTax(input, taxRate);

    // Calculate rate reconciliation
    const rateReconciliation = this.calculateRateReconciliation(
      input.profitBeforeTax,
      currentTax.totalCurrentTaxCharge,
      deferredTax.chargeToIncomeStatement,
      taxRate
    );

    // Calculate totals
    const totalTaxCharge = new Decimal(currentTax.totalCurrentTaxCharge)
      .plus(deferredTax.chargeToIncomeStatement);

    const effectiveTaxRate = new Decimal(input.profitBeforeTax).gt(0)
      ? totalTaxCharge.div(input.profitBeforeTax).mul(100)
      : new Decimal(0);

    // Calculate balance sheet positions
    const taxPayments = new Decimal(input.taxPaymentsInYear || '0');
    const openingCurrentTaxLiability = new Decimal(input.openingCurrentTaxLiability || '0');
    const openingCurrentTaxAsset = new Decimal(input.openingCurrentTaxAsset || '0');

    const netCurrentTaxMovement = new Decimal(currentTax.totalCurrentTaxCharge)
      .minus(taxPayments);

    const netCurrentTaxPosition = openingCurrentTaxLiability
      .minus(openingCurrentTaxAsset)
      .plus(netCurrentTaxMovement);

    const currentTaxAsset = netCurrentTaxPosition.lt(0)
      ? netCurrentTaxPosition.abs().toFixed(2)
      : '0.00';
    const currentTaxLiability = netCurrentTaxPosition.gt(0)
      ? netCurrentTaxPosition.toFixed(2)
      : '0.00';

    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      entityId: input.entityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      reportingFramework: input.reportingFramework,
      profitBeforeTax: input.profitBeforeTax,
      profitLossForTax: input.taxableProfit,
      currentTax,
      deferredTax,
      uncertainTaxPositions: [],
      totalUTPProvision: '0.00',
      rateReconciliation,
      totalTaxCharge: totalTaxCharge.toFixed(2),
      effectiveTaxRate: effectiveTaxRate.toFixed(2),
      currentTaxAsset,
      currentTaxLiability,
      netCurrentTaxPosition: netCurrentTaxPosition.toFixed(2),
      status: 'draft',
      calculatedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  /**
   * Calculate current tax provision
   */
  private calculateCurrentTax(
    input: TaxProvisionInput,
    taxRate: Decimal
  ): CurrentTaxProvision {
    const taxableProfit = new Decimal(input.taxableProfit);

    // UK Corporation Tax
    const ukCorporationTax = Decimal.max(taxableProfit.mul(taxRate), 0);

    // Overseas tax
    let overseasTax = new Decimal(0);
    const overseasTaxByJurisdiction = (input.overseasProfits || []).map(overseas => {
      const profit = new Decimal(overseas.profit);
      const rate = new Decimal(overseas.rate);
      const taxCharge = Decimal.max(profit.mul(rate), 0);
      overseasTax = overseasTax.plus(taxCharge);

      return {
        jurisdiction: overseas.jurisdiction,
        taxableProfit: profit.toFixed(2),
        taxRate: rate.toFixed(4),
        taxCharge: taxCharge.toFixed(2),
        withholdingTax: '0.00',
      };
    });

    // Adjustments
    const priorPeriodAdj = new Decimal(input.priorPeriodAdjustments || '0');
    const rdCredits = new Decimal(input.rdTaxCredits || '0');
    const groupRelief = new Decimal(input.groupRelief || '0');

    // Total current tax
    const totalCurrentTaxCharge = ukCorporationTax
      .plus(overseasTax)
      .plus(priorPeriodAdj)
      .minus(rdCredits)
      .minus(groupRelief.mul(taxRate));

    return {
      ukCorporationTax: ukCorporationTax.toFixed(2),
      ukCorporationTaxRate: taxRate.toFixed(4),
      overseasTax: overseasTax.toFixed(2),
      overseasTaxByJurisdiction,
      adjustmentsPriorPeriods: priorPeriodAdj.toFixed(2),
      adjustmentsCurrentPeriod: '0.00',
      rdTaxCredits: rdCredits.toFixed(2),
      otherTaxCredits: '0.00',
      groupReliefReceived: groupRelief.toFixed(2),
      groupReliefSurrendered: '0.00',
      totalCurrentTaxCharge: Decimal.max(totalCurrentTaxCharge, 0).toFixed(2),
    };
  }

  /**
   * Calculate deferred tax provision
   */
  private calculateDeferredTax(
    input: TaxProvisionInput,
    taxRate: Decimal
  ): DeferredTaxProvision {
    const openingAsset = new Decimal(input.openingDeferredTaxAsset || '0');
    const openingLiability = new Decimal(input.openingDeferredTaxLiability || '0');

    // Process deferred tax items
    let totalDeferredTaxAsset = new Decimal(0);
    let totalDeferredTaxLiability = new Decimal(0);
    let totalMovement = new Decimal(0);

    const items: DeferredTaxItem[] = (input.deferredTaxItems || []).map(item => {
      const tempDiff = new Decimal(item.temporaryDifference);
      const deferredTaxAmount = tempDiff.mul(taxRate).abs();

      // Determine if asset or liability
      let deferredTaxAsset = '0.00';
      let deferredTaxLiability = '0.00';

      if (item.recognitionBasis !== 'not_recognised') {
        if (tempDiff.lt(0)) {
          // Deductible temporary difference = Deferred Tax Asset
          deferredTaxAsset = deferredTaxAmount.toFixed(2);
          totalDeferredTaxAsset = totalDeferredTaxAsset.plus(deferredTaxAmount);
        } else {
          // Taxable temporary difference = Deferred Tax Liability
          deferredTaxLiability = deferredTaxAmount.toFixed(2);
          totalDeferredTaxLiability = totalDeferredTaxLiability.plus(deferredTaxAmount);
        }
      }

      // Calculate movement (simplified - would compare to prior year in production)
      const movementInYear = tempDiff.gt(0) ? deferredTaxAmount : deferredTaxAmount.neg();
      totalMovement = totalMovement.plus(movementInYear);

      return {
        category: item.category,
        description: item.description,
        temporaryDifference: tempDiff.toFixed(2),
        taxRate: taxRate.toFixed(4),
        deferredTaxAsset,
        deferredTaxLiability,
        movementInYear: movementInYear.toFixed(2),
        recognitionBasis: item.recognitionBasis,
      };
    });

    // Calculate charge to income statement
    const closingNetPosition = totalDeferredTaxAsset.minus(totalDeferredTaxLiability);
    const openingNetPosition = openingAsset.minus(openingLiability);
    const chargeToIncomeStatement = openingNetPosition.minus(closingNetPosition);

    return {
      openingDeferredTaxAsset: openingAsset.toFixed(2),
      openingDeferredTaxLiability: openingLiability.toFixed(2),
      items,
      chargeToIncomeStatement: chargeToIncomeStatement.toFixed(2),
      chargeToOCI: '0.00',
      chargeToEquity: '0.00',
      acquisitionsDisposals: '0.00',
      exchangeDifferences: '0.00',
      rateChange: '0.00',
      otherMovements: '0.00',
      closingDeferredTaxAsset: totalDeferredTaxAsset.toFixed(2),
      closingDeferredTaxLiability: totalDeferredTaxLiability.toFixed(2),
      netDeferredTaxPosition: closingNetPosition.toFixed(2),
      unrecognisedDeferredTaxAssets: '0.00',
      unrecognisedLossesCarriedForward: '0.00',
    };
  }

  /**
   * Calculate effective tax rate reconciliation
   */
  private calculateRateReconciliation(
    profitBeforeTax: string,
    currentTaxCharge: string,
    deferredTaxCharge: string,
    standardRate: Decimal
  ): TaxRateReconciliation {
    const pbt = new Decimal(profitBeforeTax);
    const expectedTaxCharge = pbt.mul(standardRate);
    const actualTaxCharge = new Decimal(currentTaxCharge).plus(deferredTaxCharge);

    // Calculate effective rate
    const effectiveTaxRate = pbt.gt(0)
      ? actualTaxCharge.div(pbt).mul(100)
      : new Decimal(0);

    // Calculate difference to reconcile
    const differenceToReconcile = actualTaxCharge.minus(expectedTaxCharge);

    // Standard reconciliation items (simplified)
    const items = [];

    if (!differenceToReconcile.eq(0)) {
      items.push({
        description: 'Difference due to permanent/timing differences',
        amount: differenceToReconcile.toFixed(2),
        effectiveRateImpact: pbt.gt(0)
          ? differenceToReconcile.div(pbt).mul(100).toFixed(2)
          : '0.00',
      });
    }

    return {
      profitBeforeTax: pbt.toFixed(2),
      standardTaxRate: standardRate.mul(100).toFixed(2) + '%',
      expectedTaxCharge: expectedTaxCharge.toFixed(2),
      items,
      permanentDifferences: '0.00',
      disallowableExpenses: '0.00',
      nonTaxableIncome: '0.00',
      taxRateChanges: '0.00',
      overseasTaxRateDifferential: '0.00',
      priorPeriodAdjustments: '0.00',
      otherAdjustments: differenceToReconcile.toFixed(2),
      actualTaxCharge: actualTaxCharge.toFixed(2),
      effectiveTaxRate: effectiveTaxRate.toFixed(2) + '%',
    };
  }

  /**
   * Calculate deferred tax on rate change
   */
  calculateRateChangeImpact(
    existingProvision: TaxProvision,
    newRate: string
  ): { impact: string; adjustedItems: DeferredTaxItem[] } {
    const oldRate = new Decimal(existingProvision.deferredTax.items[0]?.taxRate || '0.25');
    const newRateDecimal = new Decimal(newRate);
    const rateDifference = newRateDecimal.minus(oldRate);

    let totalImpact = new Decimal(0);
    const adjustedItems: DeferredTaxItem[] = existingProvision.deferredTax.items.map(item => {
      const tempDiff = new Decimal(item.temporaryDifference);
      const newTaxAmount = tempDiff.mul(newRateDecimal).abs();
      const oldTaxAmount = tempDiff.mul(oldRate).abs();
      const impact = newTaxAmount.minus(oldTaxAmount);
      totalImpact = totalImpact.plus(impact);

      return {
        ...item,
        taxRate: newRateDecimal.toFixed(4),
        deferredTaxAsset: tempDiff.lt(0) && item.recognitionBasis !== 'not_recognised'
          ? newTaxAmount.toFixed(2)
          : '0.00',
        deferredTaxLiability: tempDiff.gt(0) && item.recognitionBasis !== 'not_recognised'
          ? newTaxAmount.toFixed(2)
          : '0.00',
        movementInYear: impact.toFixed(2),
      };
    });

    return {
      impact: totalImpact.toFixed(2),
      adjustedItems,
    };
  }

  /**
   * Generate tax provision summary for notes
   */
  generateProvisionSummary(provision: TaxProvision): string {
    return `
TAX PROVISION SUMMARY
=====================
Period: ${provision.periodStart.toISOString().split('T')[0]} to ${provision.periodEnd.toISOString().split('T')[0]}
Reporting Framework: ${provision.reportingFramework}

INCOME STATEMENT
----------------
Profit before tax                    ${provision.profitBeforeTax}

Current tax:
  UK Corporation Tax                 ${provision.currentTax.ukCorporationTax}
  Overseas tax                       ${provision.currentTax.overseasTax}
  Prior period adjustments           ${provision.currentTax.adjustmentsPriorPeriods}
  R&D tax credits                   (${provision.currentTax.rdTaxCredits})
                                    ──────────
  Total current tax                  ${provision.currentTax.totalCurrentTaxCharge}

Deferred tax:
  Charge to income statement         ${provision.deferredTax.chargeToIncomeStatement}
                                    ──────────
Total tax charge                     ${provision.totalTaxCharge}
                                    ══════════

Effective tax rate                   ${provision.effectiveTaxRate}

BALANCE SHEET
-------------
Current tax asset                    ${provision.currentTaxAsset}
Current tax liability                ${provision.currentTaxLiability}
Deferred tax asset                   ${provision.deferredTax.closingDeferredTaxAsset}
Deferred tax liability               ${provision.deferredTax.closingDeferredTaxLiability}

TAX RATE RECONCILIATION
-----------------------
Profit before tax × ${provision.rateReconciliation.standardTaxRate}    ${provision.rateReconciliation.expectedTaxCharge}
${provision.rateReconciliation.items.map(item => `${item.description}    ${item.amount}`).join('\n')}
                                    ──────────
Total tax charge                     ${provision.rateReconciliation.actualTaxCharge}

Effective tax rate                   ${provision.rateReconciliation.effectiveTaxRate}
`.trim();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createTaxProvisionCalculator(): TaxProvisionCalculator {
  return new TaxProvisionCalculator();
}
