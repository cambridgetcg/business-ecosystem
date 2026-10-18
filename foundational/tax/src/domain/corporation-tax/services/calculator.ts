/**
 * Corporation Tax Calculator Service
 *
 * Implements UK Corporation Tax calculation for FY2023/24 onwards:
 * - Small Profits Rate: 19% (profits <= £50,000)
 * - Main Rate: 25% (profits > £250,000)
 * - Marginal Relief: For profits between £50,000 and £250,000
 *
 * Thresholds are divided by (1 + number of associated companies)
 */

import Decimal from 'decimal.js';
import { CorporationTaxRates } from '../../value-objects/index.js';
import type { CTProfitInput, CTCalculationResult } from '../models/period.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Corporation Tax calculation result with breakdown
 */
export interface CTCalculationBreakdown {
  profitsChargeableToCT: Decimal;
  adjustedLowerLimit: Decimal;
  adjustedUpperLimit: Decimal;
  tax: Decimal;
  effectiveRate: Decimal;
  marginalRelief: Decimal;
  rateApplied: 'small_profits' | 'marginal' | 'main';
}

/**
 * Calculate Corporation Tax with marginal relief
 *
 * @param profits - Profits chargeable to Corporation Tax
 * @param associatedCompanies - Number of associated companies (affects thresholds)
 * @returns Tax calculation breakdown
 */
export function calculateCorporationTax(
  profits: Decimal | number | string,
  associatedCompanies: number = 0
): CTCalculationBreakdown {
  const profitsDecimal = new Decimal(profits);

  // Cannot have negative profits for CT calculation
  if (profitsDecimal.lte(0)) {
    return {
      profitsChargeableToCT: profitsDecimal,
      adjustedLowerLimit: new Decimal(CorporationTaxRates.LOWER_LIMIT),
      adjustedUpperLimit: new Decimal(CorporationTaxRates.UPPER_LIMIT),
      tax: new Decimal(0),
      effectiveRate: new Decimal(0),
      marginalRelief: new Decimal(0),
      rateApplied: 'small_profits',
    };
  }

  // Adjust thresholds for associated companies
  const divisor = 1 + associatedCompanies;
  const lowerLimit = new Decimal(CorporationTaxRates.LOWER_LIMIT).div(divisor);
  const upperLimit = new Decimal(CorporationTaxRates.UPPER_LIMIT).div(divisor);

  const SMALL_PROFITS_RATE = new Decimal(CorporationTaxRates.SMALL_PROFITS_RATE);
  const MAIN_RATE = new Decimal(CorporationTaxRates.MAIN_RATE);
  const MARGINAL_RELIEF_FRACTION = new Decimal(CorporationTaxRates.MARGINAL_RELIEF_FRACTION);

  let tax: Decimal;
  let marginalRelief = new Decimal(0);
  let rateApplied: 'small_profits' | 'marginal' | 'main';

  if (profitsDecimal.lte(lowerLimit)) {
    // Small profits rate
    tax = profitsDecimal.mul(SMALL_PROFITS_RATE);
    rateApplied = 'small_profits';
  } else if (profitsDecimal.gte(upperLimit)) {
    // Main rate
    tax = profitsDecimal.mul(MAIN_RATE);
    rateApplied = 'main';
  } else {
    // Marginal relief calculation
    // Tax = Profits × Main Rate - Marginal Relief
    // Marginal Relief = (Upper Limit - Profits) × (Profits / Profits) × Fraction
    // Simplified: MR = (Upper Limit - Profits) × Fraction
    const mainTax = profitsDecimal.mul(MAIN_RATE);
    marginalRelief = upperLimit.minus(profitsDecimal).mul(MARGINAL_RELIEF_FRACTION);
    tax = mainTax.minus(marginalRelief);
    rateApplied = 'marginal';
  }

  // Round to 2 decimal places
  tax = tax.toDecimalPlaces(2);
  marginalRelief = marginalRelief.toDecimalPlaces(2);

  const effectiveRate = profitsDecimal.gt(0)
    ? tax.div(profitsDecimal).toDecimalPlaces(6)
    : new Decimal(0);

  return {
    profitsChargeableToCT: profitsDecimal,
    adjustedLowerLimit: lowerLimit,
    adjustedUpperLimit: upperLimit,
    tax,
    effectiveRate,
    marginalRelief,
    rateApplied,
  };
}

/**
 * Calculate full CT period from profit inputs
 */
export function calculateCTPeriod(
  input: CTProfitInput,
  associatedCompanies: number = 0
): CTCalculationResult {
  // Parse all inputs to Decimal
  const tradingProfits = new Decimal(input.tradingProfits);
  const tradingLossesBroughtForward = new Decimal(input.tradingLossesBroughtForward);
  const tradingLossesCarriedBack = new Decimal(input.tradingLossesCarriedBack);
  const investmentIncome = new Decimal(input.investmentIncome);
  const propertyIncome = new Decimal(input.propertyIncome);
  const otherIncome = new Decimal(input.otherIncome);
  const chargeableGains = new Decimal(input.chargeableGains);
  const capitalLossesBroughtForward = new Decimal(input.capitalLossesBroughtForward);
  const tradingLossesRelief = new Decimal(input.tradingLossesRelief);
  const groupRelief = new Decimal(input.groupRelief);
  const managementExpenses = new Decimal(input.managementExpenses);
  const qualifyingCharitableDonations = new Decimal(input.qualifyingCharitableDonations);
  const rdTaxCredits = new Decimal(input.rdTaxCredits || '0');
  const foreignTaxCredit = new Decimal(input.foreignTaxCredit || '0');
  const otherCredits = new Decimal(input.otherCredits || '0');

  // Step 1: Calculate trading profits after losses
  const netTradingProfits = Decimal.max(
    tradingProfits
      .minus(tradingLossesBroughtForward)
      .minus(tradingLossesCarriedBack),
    0
  );

  // Step 2: Calculate chargeable gains after capital losses
  const capitalLossesUsed = Decimal.min(capitalLossesBroughtForward, chargeableGains);
  const netChargeableGains = chargeableGains.minus(capitalLossesUsed);

  // Step 3: Total profits before deductions
  const totalProfitsBeforeDeductions = netTradingProfits
    .plus(investmentIncome)
    .plus(propertyIncome)
    .plus(otherIncome)
    .plus(netChargeableGains);

  // Step 4: Apply deductions
  const totalDeductions = tradingLossesRelief
    .plus(groupRelief)
    .plus(managementExpenses)
    .plus(qualifyingCharitableDonations);

  const profitsChargeableToCT = Decimal.max(
    totalProfitsBeforeDeductions.minus(totalDeductions),
    0
  );

  // Step 5: Calculate Corporation Tax
  const taxCalc = calculateCorporationTax(profitsChargeableToCT, associatedCompanies);

  // Step 6: Apply credits
  const totalCredits = rdTaxCredits.plus(foreignTaxCredit).plus(otherCredits);
  const taxDue = Decimal.max(taxCalc.tax.minus(totalCredits), 0);

  // Determine how much was at each rate (for detailed breakdown)
  let smallProfitsRateAmount = new Decimal(0);
  let mainRateAmount = new Decimal(0);

  if (taxCalc.rateApplied === 'small_profits') {
    smallProfitsRateAmount = profitsChargeableToCT;
  } else if (taxCalc.rateApplied === 'main') {
    mainRateAmount = profitsChargeableToCT;
  } else {
    // Marginal - technically all profits taxed at main rate with relief
    mainRateAmount = profitsChargeableToCT;
  }

  return {
    totalProfitsBeforeDeductions: totalProfitsBeforeDeductions.toFixed(2),
    profitsChargeableToCT: profitsChargeableToCT.toFixed(2),
    adjustedLowerLimit: taxCalc.adjustedLowerLimit.toFixed(2),
    adjustedUpperLimit: taxCalc.adjustedUpperLimit.toFixed(2),
    smallProfitsRateAmount: smallProfitsRateAmount.toFixed(2),
    mainRateAmount: mainRateAmount.toFixed(2),
    marginalReliefAmount: taxCalc.marginalRelief.toFixed(2),
    effectiveRate: taxCalc.effectiveRate.toFixed(6),
    corporationTaxLiability: taxCalc.tax.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    taxDue: taxDue.toFixed(2),
    rateApplied: taxCalc.rateApplied,
  };
}

/**
 * Calculate instalment payments for large/very large companies
 * Required if CT liability > £10,000 and profits > £1.5m (adjusted for associates)
 */
export function calculateInstalments(
  profits: Decimal | number | string,
  taxLiability: Decimal | number | string,
  associatedCompanies: number = 0
): { required: boolean; instalments: Array<{ date: Date; amount: string }> } {
  const profitsDecimal = new Decimal(profits);
  const taxDecimal = new Decimal(taxLiability);

  // Thresholds adjusted for associated companies
  const divisor = 1 + associatedCompanies;
  const largeCompanyThreshold = new Decimal(1500000).div(divisor);
  const veryLargeThreshold = new Decimal(20000000).div(divisor);

  // Small CT liability - no instalments
  if (taxDecimal.lte(10000)) {
    return { required: false, instalments: [] };
  }

  // Below large company threshold - no instalments
  if (profitsDecimal.lt(largeCompanyThreshold)) {
    return { required: false, instalments: [] };
  }

  // Calculate quarterly instalment amount
  const instalmentAmount = taxDecimal.div(4).toDecimalPlaces(2);

  // For simplicity, return placeholder dates (would need period dates in real implementation)
  const instalments = [
    { date: new Date(), amount: instalmentAmount.toFixed(2) },
    { date: new Date(), amount: instalmentAmount.toFixed(2) },
    { date: new Date(), amount: instalmentAmount.toFixed(2) },
    { date: new Date(), amount: instalmentAmount.toFixed(2) },
  ];

  return { required: true, instalments };
}

/**
 * Calculate effective tax rate
 */
export function getEffectiveTaxRate(
  profits: Decimal | number | string,
  associatedCompanies: number = 0
): string {
  const result = calculateCorporationTax(profits, associatedCompanies);
  return result.effectiveRate.mul(100).toFixed(2) + '%';
}
