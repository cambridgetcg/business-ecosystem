import { Decimal } from 'decimal.js';
import type { CurrencyCode, Money } from '@foundational/shared';
import type {
  TaxJurisdiction,
  TaxNexus,
  TaxObligation,
  TaxFiling,
  TaxPosition,
} from '../../domain/entities/index.js';

/**
 * Tax Service
 *
 * Core business logic for tax management including:
 * - Nexus determination and tracking
 * - Tax obligation calculations
 * - Filing management
 * - Uncertain tax position tracking
 * - Multi-entity/multi-jurisdiction coordination
 */
export class TaxService {
  // In-memory stores for reference implementation
  private jurisdictions: Map<string, TaxJurisdiction> = new Map();
  private nexusRecords: Map<string, TaxNexus> = new Map();
  private obligations: Map<string, TaxObligation> = new Map();
  private filings: Map<string, TaxFiling> = new Map();
  private positions: Map<string, TaxPosition> = new Map();

  /**
   * Get all jurisdictions where an entity has tax nexus
   */
  async getEntityNexus(entityId: string): Promise<TaxNexus[]> {
    return Array.from(this.nexusRecords.values())
      .filter(n => n.entityId === entityId && !n.terminatedDate);
  }

  /**
   * Get upcoming tax obligations for an entity
   */
  async getUpcomingObligations(
    entityId: string,
    daysAhead: number = 90
  ): Promise<TaxObligation[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return Array.from(this.obligations.values())
      .filter(o => o.entityId === entityId)
      .filter(o => o.status !== 'closed' && o.status !== 'paid')
      .filter(o => o.filingDueDate <= cutoffDate)
      .sort((a, b) => a.filingDueDate.getTime() - b.filingDueDate.getTime());
  }

  /**
   * Calculate estimated quarterly tax
   */
  calculateQuarterlyEstimate(
    annualTaxableIncome: Decimal,
    jurisdiction: TaxJurisdiction,
    quarter: 1 | 2 | 3 | 4
  ): Decimal {
    // Simplified calculation - real implementation would use jurisdiction-specific rates
    const annualTax = annualTaxableIncome.times(0.21); // Federal corporate rate
    const quarterlyPayment = annualTax.dividedBy(4);

    // Safe harbor: pay 100% of prior year or 25% each quarter
    return quarterlyPayment;
  }

  /**
   * Get total unrecognized tax benefits (UTB) for an entity
   */
  async getTotalUTB(entityId: string): Promise<{ amount: Decimal; currency: CurrencyCode }> {
    const entityPositions = Array.from(this.positions.values())
      .filter(p => p.entityId === entityId)
      .filter(p => p.status !== 'closed' && p.status !== 'resolved');

    const totalUTB = entityPositions.reduce(
      (sum, p) => sum.plus(p.unrecognizedBenefit),
      new Decimal(0)
    );

    return {
      amount: totalUTB,
      currency: entityPositions[0]?.currency ?? 'USD',
    };
  }

  /**
   * Get filing calendar for entity
   */
  async getFilingCalendar(
    entityId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TaxObligation[]> {
    return Array.from(this.obligations.values())
      .filter(o => o.entityId === entityId)
      .filter(o => o.filingDueDate >= startDate && o.filingDueDate <= endDate)
      .sort((a, b) => a.filingDueDate.getTime() - b.filingDueDate.getTime());
  }

  /**
   * Check if entity is subject to CFC rules
   */
  async checkCFCStatus(
    entityId: string,
    parentEntityId: string,
    ownershipPercentage: Decimal
  ): Promise<{ isCFC: boolean; reason?: string }> {
    // Controlled Foreign Corporation: >50% ownership by US shareholders
    if (ownershipPercentage.greaterThan(50)) {
      return {
        isCFC: true,
        reason: `Ownership of ${ownershipPercentage.toString()}% exceeds 50% threshold`,
      };
    }

    return { isCFC: false };
  }

  /**
   * Calculate withholding tax on cross-border payment
   */
  calculateWithholding(
    paymentAmount: Decimal,
    sourceCountry: string,
    recipientCountry: string,
    paymentType: 'dividend' | 'interest' | 'royalty' | 'services'
  ): { rate: Decimal; amount: Decimal } {
    // Simplified - real implementation would use treaty rates
    const defaultRates: Record<string, Decimal> = {
      dividend: new Decimal(0.30),
      interest: new Decimal(0.30),
      royalty: new Decimal(0.30),
      services: new Decimal(0),
    };

    const rate = defaultRates[paymentType] ?? new Decimal(0.30);
    const amount = paymentAmount.times(rate);

    return { rate, amount };
  }
}

export default TaxService;
