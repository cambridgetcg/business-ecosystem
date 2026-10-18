/**
 * PAYE and National Insurance Calculator Service
 *
 * Implements UK PAYE tax and National Insurance calculations:
 * - Income Tax (PAYE)
 * - National Insurance (employee and employer)
 * - Student Loan deductions
 * - Director NI calculations
 */

import Decimal from 'decimal.js';
import {
  NIThresholds2024,
  NIRates2024,
  PersonalAllowance2024,
  IncomeTaxBands2024,
  ScottishIncomeTaxBands2024,
  WelshIncomeTaxBands2024,
  StudentLoanThresholds2024,
  PeriodsPerYear,
  TaxRegion,
  type NICategory,
  type StudentLoanPlan,
  type PaymentFrequency,
} from '../../value-objects/index.js';
import { parseTaxCode, type PayPeriodInput } from '../models/employee.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// =============================================================================
// Result Types
// =============================================================================

export interface NICalculationResult {
  employeeNI: string;
  employerNI: string;
  niablePay: string;
  breakdown: {
    earningsToLEL: string;
    earningsLELtoPT: string;
    earningsPTtoUEL: string;
    earningsAboveUEL: string;
    employerEarningsSTtoUEL: string;
    employerEarningsAboveUEL: string;
  };
}

export interface PAYECalculationResult {
  grossPay: string;
  taxablePay: string;
  taxDue: string;
  taxDeducted: string;
  taxAdjustment: string;
  taxRegion: TaxRegion;
  breakdown: {
    starterRateTax?: string;  // Scottish only
    basicRateTax: string;
    intermediateRateTax?: string;  // Scottish only
    higherRateTax: string;
    additionalRateTax: string;
    allowanceUsed: string;
  };
}

export interface StudentLoanResult {
  plan1: string;
  plan2: string;
  plan4: string;
  plan5: string;
  postgrad: string;
  total: string;
}

export interface PayrollCalculationResult {
  grossPay: string;
  taxablePay: string;
  niablePay: string;
  paye: PAYECalculationResult;
  ni: NICalculationResult;
  studentLoan: StudentLoanResult;
  pensionDeduction: string;
  netPay: string;
  totalDeductions: string;
  employerCosts: {
    grossPay: string;
    employerNI: string;
    employerPension: string;
    apprenticeshipLevy: string;
    total: string;
  };
}

// =============================================================================
// National Insurance Calculator
// =============================================================================

/**
 * Calculate weekly National Insurance contributions
 *
 * 2024/25 rates (from April 2024):
 * - Employee: 8% between PT (£242) and UEL (£967), 2% above UEL
 * - Employer: 13.8% above ST (£175)
 *
 * @param weeklyPay - Gross weekly pay
 * @param category - NI category (A, B, C, etc.)
 */
export function calculateWeeklyNI(
  weeklyPay: Decimal | number | string,
  category: NICategory = 'A'
): NICalculationResult {
  const pay = new Decimal(weeklyPay);

  // Get thresholds
  const LEL = NIThresholds2024.LEL;
  const PT = NIThresholds2024.PT;
  const ST = NIThresholds2024.ST;
  const UEL = NIThresholds2024.UEL;

  // Calculate earnings in each band
  const earningsToLEL = Decimal.max(Decimal.min(pay, LEL), 0);
  const earningsLELtoPT = Decimal.max(Decimal.min(pay, PT).minus(LEL), 0);
  const earningsPTtoUEL = Decimal.max(Decimal.min(pay, UEL).minus(PT), 0);
  const earningsAboveUEL = Decimal.max(pay.minus(UEL), 0);
  const employerEarningsSTtoUEL = Decimal.max(Decimal.min(pay, UEL).minus(ST), 0);
  const employerEarningsAboveUEL = earningsAboveUEL;

  let employeeNI = new Decimal(0);
  let employerNI = new Decimal(0);

  // Calculate based on NI category
  switch (category) {
    case 'A': // Standard
    case 'F': // Freeport
    case 'I': // Married women's reduced (contracted out - historical)
    case 'L': // Freeport + deferment
      // Employee NI
      employeeNI = earningsPTtoUEL.mul(NIRates2024.employee.main)
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      // Employer NI
      employerNI = Decimal.max(pay.minus(ST), 0).mul(NIRates2024.employer.standard);
      break;

    case 'B': // Married women's reduced rate
      // Reduced rate for employee
      employeeNI = earningsPTtoUEL.mul(0.0585) // 5.85% main
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      employerNI = Decimal.max(pay.minus(ST), 0).mul(NIRates2024.employer.standard);
      break;

    case 'C': // Over State Pension age
    case 'S': // State Pension age
      // No employee NI
      employeeNI = new Decimal(0);
      // Employer still pays
      employerNI = Decimal.max(pay.minus(ST), 0).mul(NIRates2024.employer.standard);
      break;

    case 'H': // Apprentice under 25
      // Employee pays as normal
      employeeNI = earningsPTtoUEL.mul(NIRates2024.employee.main)
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      // Employer: 0% up to AUST, then 13.8%
      const apprenticeExcess = Decimal.max(pay.minus(NIThresholds2024.AUST), 0);
      employerNI = apprenticeExcess.mul(NIRates2024.employer.standard);
      break;

    case 'M': // Under 21
      // Employee pays as normal
      employeeNI = earningsPTtoUEL.mul(NIRates2024.employee.main)
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      // Employer: 0% up to UST, then 13.8%
      const under21Excess = Decimal.max(pay.minus(NIThresholds2024.UST), 0);
      employerNI = under21Excess.mul(NIRates2024.employer.standard);
      break;

    case 'V': // Veterans
      // Employee pays as normal
      employeeNI = earningsPTtoUEL.mul(NIRates2024.employee.main)
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      // Employer: 0% up to VUST, then 13.8%
      const veteranExcess = Decimal.max(pay.minus(NIThresholds2024.VUST), 0);
      employerNI = veteranExcess.mul(NIRates2024.employer.standard);
      break;

    case 'J': // Deferment
    case 'Z': // Under 21 + deferment
      // Deferment: only 2% above UEL
      employeeNI = earningsAboveUEL.mul(NIRates2024.employee.additional);
      // Employer pays as normal
      employerNI = Decimal.max(pay.minus(ST), 0).mul(NIRates2024.employer.standard);
      break;

    default:
      // Default to Category A
      employeeNI = earningsPTtoUEL.mul(NIRates2024.employee.main)
        .plus(earningsAboveUEL.mul(NIRates2024.employee.additional));
      employerNI = Decimal.max(pay.minus(ST), 0).mul(NIRates2024.employer.standard);
  }

  return {
    employeeNI: employeeNI.toFixed(2),
    employerNI: employerNI.toFixed(2),
    niablePay: pay.toFixed(2),
    breakdown: {
      earningsToLEL: earningsToLEL.toFixed(2),
      earningsLELtoPT: earningsLELtoPT.toFixed(2),
      earningsPTtoUEL: earningsPTtoUEL.toFixed(2),
      earningsAboveUEL: earningsAboveUEL.toFixed(2),
      employerEarningsSTtoUEL: employerEarningsSTtoUEL.toFixed(2),
      employerEarningsAboveUEL: employerEarningsAboveUEL.toFixed(2),
    },
  };
}

/**
 * Convert weekly NI thresholds to period amounts
 */
export function getNIThresholdsForPeriod(frequency: PaymentFrequency): typeof NIThresholds2024 {
  const periods = PeriodsPerYear[frequency];
  const weeksPerPeriod = 52 / periods;

  return {
    LEL: Math.round(NIThresholds2024.LEL * weeksPerPeriod),
    PT: Math.round(NIThresholds2024.PT * weeksPerPeriod),
    ST: Math.round(NIThresholds2024.ST * weeksPerPeriod),
    FUST: Math.round(NIThresholds2024.FUST * weeksPerPeriod),
    UST: Math.round(NIThresholds2024.UST * weeksPerPeriod),
    AUST: Math.round(NIThresholds2024.AUST * weeksPerPeriod),
    VUST: Math.round(NIThresholds2024.VUST * weeksPerPeriod),
    UEL: Math.round(NIThresholds2024.UEL * weeksPerPeriod),
  };
}

/**
 * Calculate NI for a pay period (any frequency)
 */
export function calculatePeriodNI(
  periodPay: Decimal | number | string,
  frequency: PaymentFrequency,
  category: NICategory = 'A'
): NICalculationResult {
  const periods = PeriodsPerYear[frequency];
  const weeksPerPeriod = 52 / periods;

  // Convert period pay to weekly equivalent for calculation
  const weeklyEquivalent = new Decimal(periodPay).div(weeksPerPeriod);

  // Calculate weekly NI
  const weeklyResult = calculateWeeklyNI(weeklyEquivalent, category);

  // Convert back to period amounts
  const periodMultiplier = new Decimal(weeksPerPeriod);

  return {
    employeeNI: new Decimal(weeklyResult.employeeNI).mul(periodMultiplier).toFixed(2),
    employerNI: new Decimal(weeklyResult.employerNI).mul(periodMultiplier).toFixed(2),
    niablePay: periodPay.toString(),
    breakdown: {
      earningsToLEL: new Decimal(weeklyResult.breakdown.earningsToLEL).mul(periodMultiplier).toFixed(2),
      earningsLELtoPT: new Decimal(weeklyResult.breakdown.earningsLELtoPT).mul(periodMultiplier).toFixed(2),
      earningsPTtoUEL: new Decimal(weeklyResult.breakdown.earningsPTtoUEL).mul(periodMultiplier).toFixed(2),
      earningsAboveUEL: new Decimal(weeklyResult.breakdown.earningsAboveUEL).mul(periodMultiplier).toFixed(2),
      employerEarningsSTtoUEL: new Decimal(weeklyResult.breakdown.employerEarningsSTtoUEL).mul(periodMultiplier).toFixed(2),
      employerEarningsAboveUEL: new Decimal(weeklyResult.breakdown.employerEarningsAboveUEL).mul(periodMultiplier).toFixed(2),
    },
  };
}

// =============================================================================
// PAYE Calculator
// =============================================================================

/**
 * Calculate PAYE tax for a period (cumulative basis)
 *
 * @param periodPay - Gross pay for this period
 * @param taxCode - Employee's tax code
 * @param periodNumber - Current period number (1-12 for monthly)
 * @param taxPaidToDate - Tax already paid this tax year
 * @param taxablePayToDate - Taxable pay already earned this tax year
 * @param frequency - Payment frequency
 * @param useWeek1Month1 - Use non-cumulative (Week 1/Month 1) basis
 */
export function calculatePAYE(
  periodPay: Decimal | number | string,
  taxCode: string,
  periodNumber: number,
  taxPaidToDate: Decimal | number | string = 0,
  taxablePayToDate: Decimal | number | string = 0,
  frequency: PaymentFrequency = 'monthly',
  useWeek1Month1: boolean = false
): PAYECalculationResult {
  const grossPay = new Decimal(periodPay);
  const priorTaxPaid = new Decimal(taxPaidToDate);
  const priorTaxablePay = new Decimal(taxablePayToDate);

  // Parse tax code
  const { allowance, isScottish, isWelsh, isKCode, suffix } = parseTaxCode(taxCode);

  // Determine tax region
  const taxRegion: TaxRegion = isScottish
    ? TaxRegion.SCOTLAND
    : isWelsh
      ? TaxRegion.WALES
      : TaxRegion.REST_OF_UK;

  // Handle special codes
  if (suffix === 'NT') {
    // No Tax
    return {
      grossPay: grossPay.toFixed(2),
      taxablePay: '0.00',
      taxDue: '0.00',
      taxDeducted: '0.00',
      taxAdjustment: '0.00',
      taxRegion,
      breakdown: {
        basicRateTax: '0.00',
        higherRateTax: '0.00',
        additionalRateTax: '0.00',
        allowanceUsed: '0.00',
      },
    };
  }

  // Get number of periods per year
  const periodsPerYear = PeriodsPerYear[frequency];

  // Calculate cumulative allowance to date (or single period for W1/M1)
  const effectivePeriods = useWeek1Month1 ? 1 : periodNumber;
  const cumulativeAllowance = new Decimal(allowance).mul(effectivePeriods).div(periodsPerYear);

  // For K codes, add taxable amount instead of subtracting allowance
  let totalTaxablePay: Decimal;
  let periodTaxablePay: Decimal;

  if (isKCode) {
    // K code: add the K code amount to pay
    const kAmount = Math.abs(allowance);
    const kAmountForPeriod = new Decimal(kAmount).mul(effectivePeriods).div(periodsPerYear);

    if (useWeek1Month1) {
      periodTaxablePay = grossPay.plus(new Decimal(kAmount).div(periodsPerYear));
      totalTaxablePay = periodTaxablePay;
    } else {
      totalTaxablePay = priorTaxablePay.plus(grossPay).plus(kAmountForPeriod.minus(
        new Decimal(kAmount).mul(periodNumber - 1).div(periodsPerYear)
      ));
      periodTaxablePay = grossPay.plus(new Decimal(kAmount).div(periodsPerYear));
    }
  } else {
    // Normal code: subtract allowance from pay
    if (useWeek1Month1) {
      const periodAllowance = new Decimal(allowance).div(periodsPerYear);
      periodTaxablePay = Decimal.max(grossPay.minus(periodAllowance), 0);
      totalTaxablePay = periodTaxablePay;
    } else {
      const cumulativePay = priorTaxablePay.plus(grossPay);
      totalTaxablePay = Decimal.max(cumulativePay.minus(cumulativeAllowance), 0);
      periodTaxablePay = Decimal.max(grossPay.minus(cumulativeAllowance.minus(
        new Decimal(allowance).mul(periodNumber - 1).div(periodsPerYear)
      )), 0);
    }
  }

  // Calculate tax on total taxable pay (cumulative)
  let cumulativeTax = new Decimal(0);
  let remainingTaxable = totalTaxablePay;
  let starterRateTax = new Decimal(0);    // Scottish only
  let basicRateTax = new Decimal(0);
  let intermediateRateTax = new Decimal(0);  // Scottish only
  let higherRateTax = new Decimal(0);
  let additionalRateTax = new Decimal(0);

  // Handle BR (Basic Rate only) and D0/D1 codes
  if (suffix === 'BR') {
    cumulativeTax = totalTaxablePay.mul(0.20);
    basicRateTax = cumulativeTax;
  } else if (suffix === 'D0') {
    cumulativeTax = totalTaxablePay.mul(0.40);
    higherRateTax = cumulativeTax;
  } else if (suffix === 'D1') {
    cumulativeTax = totalTaxablePay.mul(0.45);
    additionalRateTax = cumulativeTax;
  } else if (isScottish) {
    // Scottish bands (5-band system)
    const scottishBands = ScottishIncomeTaxBands2024;

    // Scale thresholds to cumulative periods
    const starterThreshold = new Decimal(scottishBands.starter.threshold).mul(effectivePeriods).div(periodsPerYear);
    const basicThreshold = new Decimal(scottishBands.basic.threshold).mul(effectivePeriods).div(periodsPerYear);
    const intermediateThreshold = new Decimal(scottishBands.intermediate.threshold).mul(effectivePeriods).div(periodsPerYear);
    const higherThreshold = new Decimal(scottishBands.higher.threshold).mul(effectivePeriods).div(periodsPerYear);

    // Starter rate (19%)
    const starterAmount = Decimal.min(remainingTaxable, starterThreshold);
    starterRateTax = starterAmount.mul(scottishBands.starter.rate);
    remainingTaxable = remainingTaxable.minus(starterAmount);

    // Basic rate (20%)
    const basicAmount = Decimal.min(remainingTaxable, basicThreshold.minus(starterThreshold));
    basicRateTax = basicAmount.mul(scottishBands.basic.rate);
    remainingTaxable = remainingTaxable.minus(basicAmount);

    // Intermediate rate (21%)
    const intermediateAmount = Decimal.min(remainingTaxable, intermediateThreshold.minus(basicThreshold));
    intermediateRateTax = intermediateAmount.mul(scottishBands.intermediate.rate);
    remainingTaxable = remainingTaxable.minus(intermediateAmount);

    // Higher rate (42%)
    const higherAmount = Decimal.min(remainingTaxable, higherThreshold.minus(intermediateThreshold));
    higherRateTax = higherAmount.mul(scottishBands.higher.rate);
    remainingTaxable = remainingTaxable.minus(higherAmount);

    // Top rate (47%)
    additionalRateTax = remainingTaxable.mul(scottishBands.top.rate);

    cumulativeTax = starterRateTax.plus(basicRateTax).plus(intermediateRateTax).plus(higherRateTax).plus(additionalRateTax);
  } else {
    // Rest of UK bands (England/NI or Wales)
    // Welsh rates are currently identical to England/NI but may diverge in future
    const rUKBands = isWelsh ? WelshIncomeTaxBands2024 : IncomeTaxBands2024;

    // Scale thresholds to cumulative periods
    const basicThreshold = new Decimal(rUKBands.basic.threshold).mul(effectivePeriods).div(periodsPerYear);
    const higherThreshold = new Decimal(rUKBands.higher.threshold).mul(effectivePeriods).div(periodsPerYear);

    // Basic rate (20%)
    const basicAmount = Decimal.min(remainingTaxable, basicThreshold);
    basicRateTax = basicAmount.mul(rUKBands.basic.rate);
    remainingTaxable = remainingTaxable.minus(basicAmount);

    // Higher rate (40%)
    const higherAmount = Decimal.min(remainingTaxable, higherThreshold.minus(basicThreshold));
    higherRateTax = higherAmount.mul(rUKBands.higher.rate);
    remainingTaxable = remainingTaxable.minus(higherAmount);

    // Additional rate (45%)
    additionalRateTax = remainingTaxable.mul(rUKBands.additional.rate);

    cumulativeTax = basicRateTax.plus(higherRateTax).plus(additionalRateTax);
  }

  // Calculate tax for this period (cumulative - prior)
  const taxDeducted = useWeek1Month1 ? cumulativeTax : cumulativeTax.minus(priorTaxPaid);
  const taxAdjustment = taxDeducted.minus(periodTaxablePay.mul(0.20)); // Rough estimate of normal

  // Build breakdown with optional Scottish-specific fields
  const breakdown: PAYECalculationResult['breakdown'] = {
    basicRateTax: basicRateTax.toFixed(2),
    higherRateTax: higherRateTax.toFixed(2),
    additionalRateTax: additionalRateTax.toFixed(2),
    allowanceUsed: cumulativeAllowance.toFixed(2),
  };

  // Add Scottish-specific breakdown fields
  if (isScottish) {
    breakdown.starterRateTax = starterRateTax.toFixed(2);
    breakdown.intermediateRateTax = intermediateRateTax.toFixed(2);
  }

  return {
    grossPay: grossPay.toFixed(2),
    taxablePay: periodTaxablePay.toFixed(2),
    taxDue: cumulativeTax.toFixed(2),
    taxDeducted: Decimal.max(taxDeducted, 0).toFixed(2),
    taxAdjustment: taxAdjustment.toFixed(2),
    taxRegion,
    breakdown,
  };
}

// =============================================================================
// Student Loan Calculator
// =============================================================================

/**
 * Calculate student loan deductions for a period
 */
export function calculateStudentLoan(
  periodPay: Decimal | number | string,
  plans: StudentLoanPlan[],
  frequency: PaymentFrequency = 'monthly'
): StudentLoanResult {
  const pay = new Decimal(periodPay);
  const periods = PeriodsPerYear[frequency];

  const result: StudentLoanResult = {
    plan1: '0.00',
    plan2: '0.00',
    plan4: '0.00',
    plan5: '0.00',
    postgrad: '0.00',
    total: '0.00',
  };

  let total = new Decimal(0);

  for (const plan of plans) {
    const thresholds = StudentLoanThresholds2024[plan];
    const periodThreshold = new Decimal(thresholds.threshold).div(periods);

    if (pay.gt(periodThreshold)) {
      const deduction = pay.minus(periodThreshold).mul(thresholds.rate);
      const roundedDeduction = deduction.toDecimalPlaces(2, Decimal.ROUND_DOWN);

      result[plan] = roundedDeduction.toFixed(2);
      total = total.plus(roundedDeduction);
    }
  }

  result.total = total.toFixed(2);
  return result;
}

// =============================================================================
// Full Payroll Calculator
// =============================================================================

/**
 * Calculate full payroll for an employee period
 */
export function calculatePayroll(
  input: PayPeriodInput,
  taxCode: string,
  niCategory: NICategory,
  frequency: PaymentFrequency,
  studentLoanPlans: StudentLoanPlan[],
  ytdTaxPaid: string = '0',
  ytdTaxablePay: string = '0',
  useWeek1Month1: boolean = false,
  employerPensionContribution: string = '0'
): PayrollCalculationResult {
  const grossPay = new Decimal(input.grossPay);
  const preTaxDeductions = new Decimal(input.preTaxDeductions);
  const pensionContribution = new Decimal(input.pensionContribution);

  // Calculate taxable pay (after pension if net pay arrangement)
  const taxableGross = input.pensionMethod === 'net_pay'
    ? grossPay.minus(pensionContribution).minus(preTaxDeductions)
    : grossPay.minus(preTaxDeductions);

  // Calculate PAYE
  const paye = calculatePAYE(
    taxableGross,
    taxCode,
    input.periodNumber,
    ytdTaxPaid,
    ytdTaxablePay,
    frequency,
    useWeek1Month1
  );

  // Calculate NI (on gross, not reduced by pension)
  const ni = calculatePeriodNI(grossPay.minus(preTaxDeductions), frequency, niCategory);

  // Calculate student loans (on gross)
  const studentLoan = calculateStudentLoan(grossPay, studentLoanPlans, frequency);

  // Calculate net pay
  const totalDeductions = new Decimal(paye.taxDeducted)
    .plus(ni.employeeNI)
    .plus(studentLoan.total)
    .plus(pensionContribution);

  const netPay = grossPay.minus(totalDeductions);

  // Employer costs
  const employerPension = new Decimal(employerPensionContribution);
  // Apprenticeship Levy: 0.5% of pay bill over £3m (simplified: assume not applicable)
  const apprenticeshipLevy = new Decimal(0);

  const totalEmployerCost = grossPay
    .plus(ni.employerNI)
    .plus(employerPension)
    .plus(apprenticeshipLevy);

  return {
    grossPay: grossPay.toFixed(2),
    taxablePay: taxableGross.toFixed(2),
    niablePay: ni.niablePay,
    paye,
    ni,
    studentLoan,
    pensionDeduction: pensionContribution.toFixed(2),
    netPay: netPay.toFixed(2),
    totalDeductions: totalDeductions.toFixed(2),
    employerCosts: {
      grossPay: grossPay.toFixed(2),
      employerNI: ni.employerNI,
      employerPension: employerPension.toFixed(2),
      apprenticeshipLevy: apprenticeshipLevy.toFixed(2),
      total: totalEmployerCost.toFixed(2),
    },
  };
}
