/**
 * Deferred Tax Tracker Service
 *
 * Tracks deferred tax positions and movements over time.
 * Supports IFRS and UK GAAP requirements for deferred tax disclosure.
 */

import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import type { DeferredTaxItem } from '../models/provision.js';

// =============================================================================
// Deferred Tax Position Types
// =============================================================================

export interface DeferredTaxPosition {
  id: string;
  tenantId: string;
  entityId: string;
  taxYear: string; // e.g., "2024-25"

  // Category breakdown
  category: DeferredTaxItem['category'];
  description: string;

  // Amounts
  temporaryDifference: string;
  taxRate: string;
  deferredTaxAsset: string;
  deferredTaxLiability: string;

  // Recognition
  recognitionBasis: 'probable' | 'virtually_certain' | 'not_recognised';
  recognitionNotes?: string;

  // Expected reversal
  expectedReversalWithin12Months: string;
  expectedReversalAfter12Months: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface DeferredTaxMovement {
  id: string;
  positionId: string;
  fromTaxYear: string;
  toTaxYear: string;
  movementType: 'opening_balance' | 'income_statement' | 'oci' | 'equity' | 'acquisition' | 'disposal' | 'rate_change' | 'reclassification' | 'other';
  amount: string;
  description: string;
  createdAt: Date;
}

export interface DeferredTaxRollforward {
  category: string;
  openingBalance: string;
  chargeToIncomeStatement: string;
  chargeToOCI: string;
  chargeToEquity: string;
  acquisitions: string;
  disposals: string;
  rateChange: string;
  reclassifications: string;
  exchangeDifferences: string;
  other: string;
  closingBalance: string;
}

export interface DeferredTaxSummary {
  taxYear: string;
  positions: DeferredTaxPosition[];
  totalDeferredTaxAsset: string;
  totalDeferredTaxLiability: string;
  netPosition: string;
  unrecognisedAssets: string;
  rollforward: DeferredTaxRollforward[];
}

// =============================================================================
// Deferred Tax Tracker
// =============================================================================

export class DeferredTaxTracker {
  private positions: Map<string, DeferredTaxPosition> = new Map();
  private movements: Map<string, DeferredTaxMovement[]> = new Map();

  /**
   * Create or update a deferred tax position
   */
  upsertPosition(input: Omit<DeferredTaxPosition, 'id' | 'createdAt' | 'updatedAt'>): DeferredTaxPosition {
    const now = new Date();
    const key = `${input.entityId}:${input.taxYear}:${input.category}`;

    const existing = this.positions.get(key);
    const position: DeferredTaxPosition = {
      id: existing?.id || randomUUID(),
      ...input,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.positions.set(key, position);
    return position;
  }

  /**
   * Record a movement for a position
   */
  recordMovement(
    positionId: string,
    movement: Omit<DeferredTaxMovement, 'id' | 'positionId' | 'createdAt'>
  ): DeferredTaxMovement {
    const record: DeferredTaxMovement = {
      id: randomUUID(),
      positionId,
      ...movement,
      createdAt: new Date(),
    };

    const existing = this.movements.get(positionId) || [];
    existing.push(record);
    this.movements.set(positionId, existing);

    return record;
  }

  /**
   * Calculate rollforward from one period to next
   */
  calculateRollforward(
    entityId: string,
    fromTaxYear: string,
    toTaxYear: string,
    closingPositions: Array<{
      category: DeferredTaxItem['category'];
      temporaryDifference: string;
      taxRate: string;
      recognitionBasis: 'probable' | 'virtually_certain' | 'not_recognised';
    }>
  ): DeferredTaxRollforward[] {
    const rollforwards: DeferredTaxRollforward[] = [];
    const taxRate = new Decimal(closingPositions[0]?.taxRate || '0.25');

    // Get opening positions by category
    const openingByCategory = new Map<string, Decimal>();
    for (const [key, pos] of this.positions) {
      if (pos.entityId === entityId && pos.taxYear === fromTaxYear) {
        const net = new Decimal(pos.deferredTaxAsset).minus(pos.deferredTaxLiability);
        openingByCategory.set(pos.category, net);
      }
    }

    // Calculate closing positions and movements
    const categories = new Set<string>();
    for (const pos of closingPositions) {
      categories.add(pos.category);
    }
    for (const [key, pos] of this.positions) {
      if (pos.entityId === entityId && pos.taxYear === fromTaxYear) {
        categories.add(pos.category);
      }
    }

    for (const category of categories) {
      const opening = openingByCategory.get(category) || new Decimal(0);

      // Find closing position for this category
      const closingPos = closingPositions.find(p => p.category === category);
      let closing = new Decimal(0);

      if (closingPos && closingPos.recognitionBasis !== 'not_recognised') {
        const tempDiff = new Decimal(closingPos.temporaryDifference);
        closing = tempDiff.mul(taxRate);
        if (tempDiff.gt(0)) {
          closing = closing.neg(); // Liability is negative
        }
      }

      const movement = closing.minus(opening);

      rollforwards.push({
        category,
        openingBalance: opening.toFixed(2),
        chargeToIncomeStatement: movement.toFixed(2),
        chargeToOCI: '0.00',
        chargeToEquity: '0.00',
        acquisitions: '0.00',
        disposals: '0.00',
        rateChange: '0.00',
        reclassifications: '0.00',
        exchangeDifferences: '0.00',
        other: '0.00',
        closingBalance: closing.toFixed(2),
      });
    }

    return rollforwards;
  }

  /**
   * Get summary for a tax year
   */
  getSummary(entityId: string, taxYear: string): DeferredTaxSummary {
    const positions: DeferredTaxPosition[] = [];
    let totalAsset = new Decimal(0);
    let totalLiability = new Decimal(0);
    let unrecognised = new Decimal(0);

    for (const [key, pos] of this.positions) {
      if (pos.entityId === entityId && pos.taxYear === taxYear) {
        positions.push(pos);

        if (pos.recognitionBasis === 'not_recognised') {
          const tempDiff = new Decimal(pos.temporaryDifference);
          if (tempDiff.lt(0)) {
            unrecognised = unrecognised.plus(tempDiff.mul(pos.taxRate).abs());
          }
        } else {
          totalAsset = totalAsset.plus(pos.deferredTaxAsset);
          totalLiability = totalLiability.plus(pos.deferredTaxLiability);
        }
      }
    }

    return {
      taxYear,
      positions,
      totalDeferredTaxAsset: totalAsset.toFixed(2),
      totalDeferredTaxLiability: totalLiability.toFixed(2),
      netPosition: totalAsset.minus(totalLiability).toFixed(2),
      unrecognisedAssets: unrecognised.toFixed(2),
      rollforward: [],
    };
  }

  /**
   * Generate deferred tax note disclosure
   */
  generateDisclosure(entityId: string, taxYear: string): string {
    const summary = this.getSummary(entityId, taxYear);

    let disclosure = `
DEFERRED TAX DISCLOSURE
=======================
Tax Year: ${taxYear}

ANALYSIS OF DEFERRED TAX ASSETS AND LIABILITIES
------------------------------------------------
`;

    // Group by category
    const byCategory = new Map<string, { assets: Decimal; liabilities: Decimal }>();
    for (const pos of summary.positions) {
      const existing = byCategory.get(pos.category) || {
        assets: new Decimal(0),
        liabilities: new Decimal(0),
      };
      existing.assets = existing.assets.plus(pos.deferredTaxAsset);
      existing.liabilities = existing.liabilities.plus(pos.deferredTaxLiability);
      byCategory.set(pos.category, existing);
    }

    for (const [category, amounts] of byCategory) {
      const net = amounts.assets.minus(amounts.liabilities);
      const categoryLabel = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      disclosure += `${categoryLabel.padEnd(40)} ${amounts.assets.toFixed(2).padStart(12)} ${amounts.liabilities.toFixed(2).padStart(12)} ${net.toFixed(2).padStart(12)}\n`;
    }

    disclosure += `
                                        ────────────  ────────────  ────────────
Total                                   ${summary.totalDeferredTaxAsset.padStart(12)} ${summary.totalDeferredTaxLiability.padStart(12)} ${summary.netPosition.padStart(12)}
                                        ════════════  ════════════  ════════════

UNRECOGNISED DEFERRED TAX ASSETS
--------------------------------
Deferred tax assets have not been recognised in respect of the following:
Trading losses carried forward                    ${summary.unrecognisedAssets}

These assets have not been recognised as it is not considered probable
that there will be sufficient future taxable profits to utilise them.

EXPECTED REVERSAL
-----------------
The deferred tax balances are expected to reverse as follows:
`;

    let within12Months = new Decimal(0);
    let after12Months = new Decimal(0);
    for (const pos of summary.positions) {
      within12Months = within12Months.plus(pos.expectedReversalWithin12Months);
      after12Months = after12Months.plus(pos.expectedReversalAfter12Months);
    }

    disclosure += `Within 12 months                                  ${within12Months.toFixed(2)}
After 12 months                                   ${after12Months.toFixed(2)}
                                                  ────────────
Total                                             ${summary.netPosition}
`;

    return disclosure.trim();
  }

  /**
   * Assess recoverability of deferred tax assets
   */
  assessRecoverability(
    entityId: string,
    taxYear: string,
    forecastTaxableProfits: Array<{ year: string; profit: string }>
  ): {
    recoverable: string;
    unrecoverable: string;
    assessment: Array<{ category: string; asset: string; recoverable: boolean; reason: string }>;
  } {
    const summary = this.getSummary(entityId, taxYear);
    const totalForecastProfit = forecastTaxableProfits.reduce(
      (sum, f) => sum.plus(f.profit),
      new Decimal(0)
    );

    const assessment: Array<{ category: string; asset: string; recoverable: boolean; reason: string }> = [];
    let recoverable = new Decimal(0);
    let unrecoverable = new Decimal(0);

    for (const pos of summary.positions) {
      const assetAmount = new Decimal(pos.deferredTaxAsset);
      if (assetAmount.gt(0)) {
        // Simple assessment: recoverable if forecast profits exceed asset
        const tempDiff = new Decimal(pos.temporaryDifference).abs();
        const isRecoverable = totalForecastProfit.gte(tempDiff);

        assessment.push({
          category: pos.category,
          asset: assetAmount.toFixed(2),
          recoverable: isRecoverable,
          reason: isRecoverable
            ? 'Sufficient forecast taxable profits available'
            : 'Insufficient forecast taxable profits',
        });

        if (isRecoverable) {
          recoverable = recoverable.plus(assetAmount);
        } else {
          unrecoverable = unrecoverable.plus(assetAmount);
        }
      }
    }

    return {
      recoverable: recoverable.toFixed(2),
      unrecoverable: unrecoverable.toFixed(2),
      assessment,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createDeferredTaxTracker(): DeferredTaxTracker {
  return new DeferredTaxTracker();
}
