/**
 * Penalty Calculator Service
 *
 * Calculates UK HMRC penalties for late filing, late payment, and inaccuracies.
 * Supports Corporation Tax, VAT (including new points-based system), and PAYE regimes.
 */

import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import {
  type PenaltyRecord,
  type PenaltyType,
  type TaxTypeForPenalty,
  type PenaltyStatus,
  type VATPenaltyPoint,
  type VATPenaltyPointsStatus,
  type InterestCalculation,
  type PenaltySummary,
  UKPenaltyRates,
} from '../models/penalty.js';

// Configure Decimal.js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// =============================================================================
// Penalty Calculator
// =============================================================================

export class PenaltyCalculator {
  private penalties: Map<string, PenaltyRecord> = new Map();
  private vatPoints: Map<string, VATPenaltyPoint[]> = new Map();

  // ===========================================================================
  // Corporation Tax Penalties
  // ===========================================================================

  /**
   * Calculate CT late filing penalty
   */
  calculateCTLateFilingPenalty(input: {
    tenantId: string;
    entityId: string;
    taxPeriod: string;
    dueDate: Date;
    filedDate?: Date;
    taxDue: string;
  }): PenaltyRecord[] {
    const now = input.filedDate || new Date();
    const daysLate = Math.floor((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      return [];
    }

    const penalties: PenaltyRecord[] = [];
    const taxDue = new Decimal(input.taxDue);

    // 1 day late - £100 fixed penalty
    if (daysLate >= 1) {
      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_filing_fixed',
        description: 'Late filing penalty - 1 day late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate: Math.min(daysLate, 90),
        penaltyAmount: UKPenaltyRates.CT_LATE_FILING_1_DAY.toString(),
        calculationBasis: 'Fixed penalty for filing 1+ days late',
      }));
    }

    // 3 months late - Additional £100
    if (daysLate >= 90) {
      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_filing_fixed',
        description: 'Late filing penalty - 3 months late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: UKPenaltyRates.CT_LATE_FILING_3_MONTHS.toString(),
        calculationBasis: 'Additional fixed penalty for filing 3+ months late',
      }));
    }

    // 6 months late - 10% of tax due (minimum £300)
    if (daysLate >= 180) {
      const percentagePenalty = Decimal.max(
        taxDue.mul(UKPenaltyRates.CT_LATE_FILING_6_MONTHS_RATE),
        300
      );

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_filing_percentage',
        description: 'Late filing penalty - 6 months late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: percentagePenalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.CT_LATE_FILING_6_MONTHS_RATE * 100).toString() + '%',
        calculationBasis: '10% of tax due (minimum £300) for filing 6+ months late',
      }));
    }

    // 12 months late - Additional 10% of tax due
    if (daysLate >= 365) {
      const percentagePenalty = taxDue.mul(UKPenaltyRates.CT_LATE_FILING_12_MONTHS_RATE);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_filing_percentage',
        description: 'Late filing penalty - 12 months late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: percentagePenalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.CT_LATE_FILING_12_MONTHS_RATE * 100).toString() + '%',
        calculationBasis: 'Additional 10% of tax due for filing 12+ months late',
      }));
    }

    // Store penalties
    penalties.forEach(p => this.penalties.set(p.id, p));

    return penalties;
  }

  /**
   * Calculate CT late payment penalty
   */
  calculateCTLatePaymentPenalty(input: {
    tenantId: string;
    entityId: string;
    taxPeriod: string;
    dueDate: Date;
    paidDate?: Date;
    taxDue: string;
  }): PenaltyRecord[] {
    const now = input.paidDate || new Date();
    const daysLate = Math.floor((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      return [];
    }

    const penalties: PenaltyRecord[] = [];
    const taxDue = new Decimal(input.taxDue);

    // 30 days late - 5%
    if (daysLate >= 30) {
      const penalty = taxDue.mul(UKPenaltyRates.CT_LATE_PAYMENT_30_DAYS);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_payment_initial',
        description: 'Late payment penalty - 30 days late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: penalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.CT_LATE_PAYMENT_30_DAYS * 100).toString() + '%',
        calculationBasis: '5% of tax due for payment 30+ days late',
      }));
    }

    // 6 months late - Additional 5%
    if (daysLate >= 180) {
      const penalty = taxDue.mul(UKPenaltyRates.CT_LATE_PAYMENT_6_MONTHS);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_payment_extended',
        description: 'Late payment penalty - 6 months late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: penalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.CT_LATE_PAYMENT_6_MONTHS * 100).toString() + '%',
        calculationBasis: 'Additional 5% of tax due for payment 6+ months late',
      }));
    }

    // 12 months late - Additional 5%
    if (daysLate >= 365) {
      const penalty = taxDue.mul(UKPenaltyRates.CT_LATE_PAYMENT_12_MONTHS);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'corporation_tax',
        taxPeriod: input.taxPeriod,
        penaltyType: 'late_payment_12_month',
        description: 'Late payment penalty - 12 months late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: penalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.CT_LATE_PAYMENT_12_MONTHS * 100).toString() + '%',
        calculationBasis: 'Additional 5% of tax due for payment 12+ months late',
      }));
    }

    // Store penalties
    penalties.forEach(p => this.penalties.set(p.id, p));

    return penalties;
  }

  // ===========================================================================
  // VAT Penalties (New Points-Based System from Jan 2023)
  // ===========================================================================

  /**
   * Add a VAT penalty point for late submission
   */
  addVATPenaltyPoint(input: {
    tenantId: string;
    entityId: string;
    vatPeriod: string;
    dueDate: Date;
    submittedDate?: Date;
    submissionFrequency: 'monthly' | 'quarterly' | 'annually';
  }): { point?: VATPenaltyPoint; penalty?: PenaltyRecord } {
    const now = input.submittedDate || new Date();
    const daysLate = Math.floor((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLate <= 0) {
      return {};
    }

    // Create penalty point
    const expiryDate = new Date(now);
    expiryDate.setMonth(expiryDate.getMonth() + 24); // Points expire after 24 months if compliant

    const point: VATPenaltyPoint = {
      id: randomUUID(),
      tenantId: input.tenantId,
      entityId: input.entityId,
      pointNumber: this.getNextPointNumber(input.entityId),
      issuedDate: now,
      expiryDate,
      vatPeriod: input.vatPeriod,
      submissionDueDate: input.dueDate,
      actualSubmissionDate: now,
      daysLate,
      status: 'active',
      penaltyTriggered: false,
      createdAt: now,
      updatedAt: now,
    };

    // Store point
    const entityPoints = this.vatPoints.get(input.entityId) || [];
    entityPoints.push(point);
    this.vatPoints.set(input.entityId, entityPoints);

    // Check if penalty threshold reached
    const threshold = this.getVATPointsThreshold(input.submissionFrequency);
    const activePoints = entityPoints.filter(p => p.status === 'active').length;

    if (activePoints >= threshold) {
      point.penaltyTriggered = true;

      // Create £200 penalty
      const penalty = this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'vat',
        taxPeriod: input.vatPeriod,
        penaltyType: 'vat_penalty_point',
        description: `VAT late submission penalty - Penalty point threshold (${threshold}) reached`,
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: UKPenaltyRates.VAT_PENALTY_ON_THRESHOLD.toString(),
        calculationBasis: `£${UKPenaltyRates.VAT_PENALTY_ON_THRESHOLD} fixed penalty for reaching penalty point threshold`,
      });

      this.penalties.set(penalty.id, penalty);
      return { point, penalty };
    }

    return { point };
  }

  /**
   * Calculate VAT late payment penalty (new regime from Jan 2023)
   */
  calculateVATLatePaymentPenalty(input: {
    tenantId: string;
    entityId: string;
    vatPeriod: string;
    dueDate: Date;
    paidDate?: Date;
    taxDue: string;
  }): PenaltyRecord[] {
    const now = input.paidDate || new Date();
    const daysLate = Math.floor((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // No penalty for first 15 days (grace period)
    if (daysLate <= 15) {
      return [];
    }

    const penalties: PenaltyRecord[] = [];
    const taxDue = new Decimal(input.taxDue);

    // Days 16-30: 2% penalty
    if (daysLate >= 16) {
      const penalty = taxDue.mul(UKPenaltyRates.VAT_LATE_PAYMENT_16_30_DAYS);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'vat',
        taxPeriod: input.vatPeriod,
        penaltyType: 'vat_late_payment',
        description: 'VAT late payment penalty - 16-30 days late',
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate: Math.min(daysLate, 30),
        penaltyAmount: penalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: (UKPenaltyRates.VAT_LATE_PAYMENT_16_30_DAYS * 100).toString() + '%',
        calculationBasis: '2% of tax due for payment 16-30 days late',
      }));
    }

    // Day 31+: Additional 2% + daily rate
    if (daysLate >= 31) {
      const initialPenalty = taxDue.mul(UKPenaltyRates.VAT_LATE_PAYMENT_31_PLUS_DAYS);
      const daysAt31Plus = daysLate - 30;
      const dailyPenalty = taxDue.mul(UKPenaltyRates.VAT_LATE_PAYMENT_DAILY_RATE).mul(daysAt31Plus);
      const totalPenalty = initialPenalty.plus(dailyPenalty);

      penalties.push(this.createPenaltyRecord({
        tenantId: input.tenantId,
        entityId: input.entityId,
        taxType: 'vat',
        taxPeriod: input.vatPeriod,
        penaltyType: 'vat_late_payment',
        description: `VAT late payment penalty - 31+ days late (${daysAt31Plus} days at daily rate)`,
        originalDueDate: input.dueDate,
        actualDate: now,
        daysLate,
        penaltyAmount: totalPenalty.toFixed(2),
        taxDue: input.taxDue,
        penaltyRate: 'Variable (2% + daily rate)',
        calculationBasis: `2% + daily rate of 4%/year for ${daysAt31Plus} additional days`,
      }));
    }

    // Store penalties
    penalties.forEach(p => this.penalties.set(p.id, p));

    return penalties;
  }

  /**
   * Get VAT penalty points status for an entity
   */
  getVATPenaltyPointsStatus(
    entityId: string,
    submissionFrequency: 'monthly' | 'quarterly' | 'annually'
  ): VATPenaltyPointsStatus {
    const allPoints = this.vatPoints.get(entityId) || [];
    const activePoints = allPoints.filter(p => p.status === 'active');
    const threshold = this.getVATPointsThreshold(submissionFrequency);

    // Find next expiry
    let nextExpiryDate: Date | undefined;
    if (activePoints.length > 0) {
      nextExpiryDate = activePoints.reduce(
        (earliest, p) => p.expiryDate < earliest ? p.expiryDate : earliest,
        activePoints[0].expiryDate
      );
    }

    return {
      entityId,
      submissionFrequency,
      penaltyThreshold: threshold,
      activePoints: activePoints.length,
      nextExpiryDate,
      atPenaltyThreshold: activePoints.length >= threshold,
      complianceResetDate: this.calculateComplianceResetDate(entityId),
      points: allPoints,
    };
  }

  // ===========================================================================
  // PAYE Penalties
  // ===========================================================================

  /**
   * Calculate PAYE late payment penalty
   */
  calculatePAYELatePaymentPenalty(input: {
    tenantId: string;
    entityId: string;
    taxPeriod: string;
    dueDate: Date;
    paidDate?: Date;
    taxDue: string;
    defaultsInYear: number; // Number of late payments in the tax year
  }): PenaltyRecord | undefined {
    const now = input.paidDate || new Date();
    const daysLate = Math.floor((now.getTime() - input.dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // First default in tax year - no penalty (warning only)
    if (input.defaultsInYear <= 1) {
      return undefined;
    }

    // Determine penalty rate based on number of defaults
    let penaltyRate: number;
    if (input.defaultsInYear <= 3) {
      penaltyRate = UKPenaltyRates.PAYE_LATE_PAYMENT_1_6_DAYS; // 1%
    } else if (input.defaultsInYear <= 6) {
      penaltyRate = UKPenaltyRates.PAYE_LATE_PAYMENT_6_12_DAYS; // 2%
    } else {
      penaltyRate = UKPenaltyRates.PAYE_LATE_PAYMENT_12_PLUS_DAYS; // 4%
    }

    const taxDue = new Decimal(input.taxDue);
    const penalty = taxDue.mul(penaltyRate);

    const record = this.createPenaltyRecord({
      tenantId: input.tenantId,
      entityId: input.entityId,
      taxType: 'paye',
      taxPeriod: input.taxPeriod,
      penaltyType: 'late_payment_initial',
      description: `PAYE late payment penalty - Default ${input.defaultsInYear} in tax year`,
      originalDueDate: input.dueDate,
      actualDate: now,
      daysLate,
      penaltyAmount: penalty.toFixed(2),
      taxDue: input.taxDue,
      penaltyRate: (penaltyRate * 100).toString() + '%',
      calculationBasis: `${penaltyRate * 100}% for ${input.defaultsInYear} defaults in tax year`,
    });

    this.penalties.set(record.id, record);
    return record;
  }

  // ===========================================================================
  // Interest Calculation
  // ===========================================================================

  /**
   * Calculate late payment interest
   */
  calculateInterest(input: {
    principalAmount: string;
    fromDate: Date;
    toDate: Date;
    taxType: TaxTypeForPenalty;
    rateType?: 'hmrc_late_payment' | 'hmrc_repayment' | 'statutory';
  }): InterestCalculation {
    const principal = new Decimal(input.principalAmount);
    const rateType = input.rateType || 'hmrc_late_payment';

    const rate = rateType === 'hmrc_repayment'
      ? UKPenaltyRates.HMRC_REPAYMENT_INTEREST_RATE
      : UKPenaltyRates.HMRC_LATE_PAYMENT_INTEREST_RATE;

    const daysOutstanding = Math.floor(
      (input.toDate.getTime() - input.fromDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dailyRate = new Decimal(rate).div(365);
    const interest = principal.mul(dailyRate).mul(daysOutstanding);

    return {
      id: randomUUID(),
      taxType: input.taxType,
      principalAmount: input.principalAmount,
      fromDate: input.fromDate,
      toDate: input.toDate,
      daysOutstanding,
      interestRate: (rate * 100).toFixed(2) + '%',
      rateType,
      interestAmount: interest.toFixed(2),
      dailyRate: dailyRate.toFixed(6),
      calculatedAt: new Date(),
    };
  }

  // ===========================================================================
  // Penalty Management
  // ===========================================================================

  /**
   * Get penalties for an entity
   */
  getPenalties(entityId: string, options?: {
    taxType?: TaxTypeForPenalty;
    status?: PenaltyStatus;
    fromDate?: Date;
    toDate?: Date;
  }): PenaltyRecord[] {
    let penalties = Array.from(this.penalties.values())
      .filter(p => p.entityId === entityId);

    if (options?.taxType) {
      penalties = penalties.filter(p => p.taxType === options.taxType);
    }

    if (options?.status) {
      penalties = penalties.filter(p => p.status === options.status);
    }

    if (options?.fromDate) {
      penalties = penalties.filter(p => p.originalDueDate >= options.fromDate!);
    }

    if (options?.toDate) {
      penalties = penalties.filter(p => p.originalDueDate <= options.toDate!);
    }

    return penalties.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get penalty summary for an entity
   */
  getPenaltySummary(entityId: string, taxYear: string): PenaltySummary {
    const penalties = this.getPenalties(entityId).filter(p => p.taxPeriod.includes(taxYear));

    const byStatus = {
      calculated: 0,
      issued: 0,
      appealed: 0,
      paid: 0,
      cancelled: 0,
    };

    const byTaxType: Record<TaxTypeForPenalty, string> = {
      corporation_tax: '0.00',
      vat: '0.00',
      paye: '0.00',
      cis: '0.00',
      self_assessment: '0.00',
    };

    let totalPenalty = new Decimal(0);
    let totalInterest = new Decimal(0);
    let totalOutstanding = new Decimal(0);

    for (const penalty of penalties) {
      // By status
      if (penalty.status in byStatus) {
        (byStatus as any)[penalty.status]++;
      }

      // By tax type
      byTaxType[penalty.taxType] = new Decimal(byTaxType[penalty.taxType])
        .plus(penalty.penaltyAmount)
        .toFixed(2);

      // Totals
      totalPenalty = totalPenalty.plus(penalty.penaltyAmount);
      totalInterest = totalInterest.plus(penalty.interestAmount);
      totalOutstanding = totalOutstanding.plus(penalty.outstandingAmount);
    }

    return {
      entityId,
      taxYear,
      totalPenalties: penalties.length,
      totalPenaltyAmount: totalPenalty.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      byStatus,
      byTaxType,
      vatPenaltyPoints: this.getVATPenaltyPointsStatus(entityId, 'quarterly'),
    };
  }

  /**
   * Record penalty payment
   */
  recordPayment(penaltyId: string, amount: string): PenaltyRecord {
    const penalty = this.penalties.get(penaltyId);
    if (!penalty) {
      throw new Error(`Penalty not found: ${penaltyId}`);
    }

    const paidAmount = new Decimal(penalty.paidAmount).plus(amount);
    const outstanding = new Decimal(penalty.totalAmount).minus(paidAmount);

    penalty.paidAmount = paidAmount.toFixed(2);
    penalty.outstandingAmount = outstanding.toFixed(2);

    if (outstanding.lte(0)) {
      penalty.status = 'paid';
      penalty.paidDate = new Date();
    }

    penalty.updatedAt = new Date();
    return penalty;
  }

  /**
   * File an appeal
   */
  fileAppeal(penaltyId: string, appealReference: string, notes: string): PenaltyRecord {
    const penalty = this.penalties.get(penaltyId);
    if (!penalty) {
      throw new Error(`Penalty not found: ${penaltyId}`);
    }

    penalty.status = 'appealed';
    penalty.appealDate = new Date();
    penalty.appealReference = appealReference;
    penalty.appealNotes = notes;
    penalty.appealOutcome = 'pending';
    penalty.updatedAt = new Date();

    return penalty;
  }

  /**
   * Claim reasonable excuse
   */
  claimReasonableExcuse(penaltyId: string, details: string): PenaltyRecord {
    const penalty = this.penalties.get(penaltyId);
    if (!penalty) {
      throw new Error(`Penalty not found: ${penaltyId}`);
    }

    penalty.reasonableExcuseClaimed = true;
    penalty.reasonableExcuseDetails = details;
    penalty.reasonableExcuseOutcome = 'pending';
    penalty.updatedAt = new Date();

    return penalty;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private createPenaltyRecord(input: {
    tenantId: string;
    entityId: string;
    taxType: TaxTypeForPenalty;
    taxPeriod: string;
    penaltyType: PenaltyType;
    description: string;
    originalDueDate: Date;
    actualDate: Date;
    daysLate: number;
    penaltyAmount: string;
    taxDue?: string;
    penaltyRate?: string;
    calculationBasis: string;
  }): PenaltyRecord {
    const now = new Date();

    return {
      id: randomUUID(),
      tenantId: input.tenantId,
      entityId: input.entityId,
      taxType: input.taxType,
      taxPeriod: input.taxPeriod,
      penaltyType: input.penaltyType,
      description: input.description,
      originalDueDate: input.originalDueDate,
      actualDate: input.actualDate,
      daysLate: input.daysLate,
      penaltyAmount: input.penaltyAmount,
      interestAmount: '0.00',
      totalAmount: input.penaltyAmount,
      calculationBasis: input.calculationBasis,
      taxDue: input.taxDue,
      penaltyRate: input.penaltyRate,
      status: 'calculated',
      paidAmount: '0.00',
      outstandingAmount: input.penaltyAmount,
      reasonableExcuseClaimed: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private getNextPointNumber(entityId: string): number {
    const points = this.vatPoints.get(entityId) || [];
    return points.length + 1;
  }

  private getVATPointsThreshold(frequency: 'monthly' | 'quarterly' | 'annually'): number {
    switch (frequency) {
      case 'monthly':
        return UKPenaltyRates.VAT_POINTS_THRESHOLD_MONTHLY;
      case 'quarterly':
        return UKPenaltyRates.VAT_POINTS_THRESHOLD_QUARTERLY;
      case 'annually':
        return UKPenaltyRates.VAT_POINTS_THRESHOLD_ANNUALLY;
    }
  }

  private calculateComplianceResetDate(entityId: string): Date | undefined {
    const points = (this.vatPoints.get(entityId) || []).filter(p => p.status === 'active');
    if (points.length === 0) return undefined;

    // Points reset after 24 months of compliance
    const latestPoint = points.reduce(
      (latest, p) => p.issuedDate > latest.issuedDate ? p : latest,
      points[0]
    );

    const resetDate = new Date(latestPoint.issuedDate);
    resetDate.setMonth(resetDate.getMonth() + 24);
    return resetDate;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createPenaltyCalculator(): PenaltyCalculator {
  return new PenaltyCalculator();
}
