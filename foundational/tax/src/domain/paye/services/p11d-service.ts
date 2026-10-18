/**
 * P11D Benefits Calculation Service
 *
 * Calculates taxable benefits in kind for P11D reporting.
 * Implements HMRC benefit calculation rules for tax year 2024/25.
 */

import Decimal from 'decimal.js';
import type {
  P11DRecord,
  P11DSummary,
  CarBenefit,
  LoanBenefit,
} from '../models/p11d.js';

// =============================================================================
// Benefit Rates 2024/25
// =============================================================================

export const P11DRates2024 = {
  // Car benefit
  CAR_FUEL_MULTIPLIER: 27800, // £27,800 for 2024/25
  DIESEL_SUPPLEMENT: 0.04, // 4% for non-RDE2 diesels
  MAX_CAR_BENEFIT_PERCENTAGE: 0.37, // 37% maximum

  // CO2 bands (petrol/hybrid) - percentage of list price
  CO2_BANDS: [
    { co2: 0, percentage: 0.02 },     // Zero emissions
    { co2: 1, percentage: 0.02 },     // 1-50g/km (depends on electric range)
    { co2: 51, percentage: 0.15 },
    { co2: 55, percentage: 0.16 },
    { co2: 60, percentage: 0.17 },
    { co2: 65, percentage: 0.18 },
    { co2: 70, percentage: 0.19 },
    { co2: 75, percentage: 0.20 },
    { co2: 80, percentage: 0.21 },
    { co2: 85, percentage: 0.22 },
    { co2: 90, percentage: 0.23 },
    { co2: 95, percentage: 0.24 },
    { co2: 100, percentage: 0.25 },
    { co2: 105, percentage: 0.26 },
    { co2: 110, percentage: 0.27 },
    { co2: 115, percentage: 0.28 },
    { co2: 120, percentage: 0.29 },
    { co2: 125, percentage: 0.30 },
    { co2: 130, percentage: 0.31 },
    { co2: 135, percentage: 0.32 },
    { co2: 140, percentage: 0.33 },
    { co2: 145, percentage: 0.34 },
    { co2: 150, percentage: 0.35 },
    { co2: 155, percentage: 0.36 },
    { co2: 160, percentage: 0.37 }, // Max 37%
  ],

  // Electric range bands for hybrids (1-50g/km CO2)
  ELECTRIC_RANGE_BANDS: [
    { range: 130, percentage: 0.02 }, // 130+ miles
    { range: 70, percentage: 0.05 },  // 70-129 miles
    { range: 40, percentage: 0.08 },  // 40-69 miles
    { range: 30, percentage: 0.12 },  // 30-39 miles
    { range: 0, percentage: 0.14 },   // Under 30 miles
  ],

  // Van benefit
  VAN_BENEFIT: 3960, // £3,960 for 2024/25
  VAN_FUEL_BENEFIT: 757, // £757 for 2024/25
  ZERO_EMISSION_VAN_BENEFIT: 0, // £0 for zero emission vans

  // Loan benefit
  OFFICIAL_INTEREST_RATE: 0.0225, // 2.25% for 2024/25
  LOAN_EXEMPTION_THRESHOLD: 10000, // £10,000 exemption

  // Class 1A NIC
  CLASS_1A_NIC_RATE: 0.138, // 13.8%

  // Mileage rates (AMAP)
  MILEAGE_CAR_FIRST_10000: 0.45, // 45p per mile
  MILEAGE_CAR_OVER_10000: 0.25, // 25p per mile
  MILEAGE_MOTORCYCLE: 0.24, // 24p per mile
  MILEAGE_BICYCLE: 0.20, // 20p per mile

  // Relocation exemption
  RELOCATION_EXEMPTION: 8000, // £8,000
} as const;

// =============================================================================
// Car Benefit Calculator
// =============================================================================

export interface CarBenefitInput {
  listPrice: string;
  accessoriesValue?: string;
  capitalContribution?: string;
  paymentForPrivateUse?: string;
  co2Emissions: number;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid_petrol' | 'hybrid_diesel';
  electricRangeKm?: number; // For hybrids
  dateAvailableFrom: Date;
  dateAvailableTo?: Date;
  daysUnavailable?: number;
  taxYearStart: Date;
  taxYearEnd: Date;
}

export interface CarBenefitResult {
  listPriceForBenefit: string;
  appropriatePercentage: string;
  annualBenefit: string;
  proportionedBenefit: string;
  cashEquivalent: string;
  daysAvailable: number;
  breakdown: {
    basePercentage: number;
    dieselSupplement: number;
    finalPercentage: number;
    capitalContributionDeduction: string;
    privateUseDeduction: string;
  };
}

export function calculateCarBenefit(input: CarBenefitInput): CarBenefitResult {
  const {
    listPrice,
    accessoriesValue = '0',
    capitalContribution = '0',
    paymentForPrivateUse = '0',
    co2Emissions,
    fuelType,
    electricRangeKm,
    dateAvailableFrom,
    dateAvailableTo,
    daysUnavailable = 0,
    taxYearStart,
    taxYearEnd,
  } = input;

  // Calculate list price for benefit purposes
  const listPriceDecimal = new Decimal(listPrice);
  const accessoriesDecimal = new Decimal(accessoriesValue);
  const capitalContribDecimal = Decimal.min(new Decimal(capitalContribution), 5000); // Max £5,000

  const listPriceForBenefit = listPriceDecimal
    .plus(accessoriesDecimal)
    .minus(capitalContribDecimal);

  // Determine appropriate percentage based on CO2 and fuel type
  let basePercentage = getBaseCO2Percentage(co2Emissions, fuelType, electricRangeKm);

  // Add diesel supplement for non-RDE2 compliant diesels
  let dieselSupplement = 0;
  if (fuelType === 'diesel' || fuelType === 'hybrid_diesel') {
    dieselSupplement = P11DRates2024.DIESEL_SUPPLEMENT;
  }

  // Cap at maximum
  const finalPercentage = Math.min(
    basePercentage + dieselSupplement,
    P11DRates2024.MAX_CAR_BENEFIT_PERCENTAGE
  );

  // Calculate annual benefit
  const annualBenefit = listPriceForBenefit.mul(finalPercentage);

  // Calculate days available
  const yearStart = dateAvailableFrom > taxYearStart ? dateAvailableFrom : taxYearStart;
  const yearEnd = dateAvailableTo && dateAvailableTo < taxYearEnd ? dateAvailableTo : taxYearEnd;
  const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysAvailable = Math.max(0, totalDays - daysUnavailable);

  // Proportion for part year
  const daysInYear = 365;
  const proportion = new Decimal(daysAvailable).div(daysInYear);
  const proportionedBenefit = annualBenefit.mul(proportion);

  // Deduct payment for private use
  const privateUseDecimal = new Decimal(paymentForPrivateUse);
  const cashEquivalent = Decimal.max(proportionedBenefit.minus(privateUseDecimal), 0);

  return {
    listPriceForBenefit: listPriceForBenefit.toFixed(2),
    appropriatePercentage: (finalPercentage * 100).toFixed(0) + '%',
    annualBenefit: annualBenefit.toFixed(2),
    proportionedBenefit: proportionedBenefit.toFixed(2),
    cashEquivalent: cashEquivalent.toFixed(2),
    daysAvailable,
    breakdown: {
      basePercentage: basePercentage * 100,
      dieselSupplement: dieselSupplement * 100,
      finalPercentage: finalPercentage * 100,
      capitalContributionDeduction: capitalContribDecimal.toFixed(2),
      privateUseDeduction: privateUseDecimal.toFixed(2),
    },
  };
}

function getBaseCO2Percentage(
  co2: number,
  fuelType: string,
  electricRangeKm?: number
): number {
  // Electric vehicles
  if (fuelType === 'electric' || co2 === 0) {
    return 0.02; // 2% for 2024/25
  }

  // Hybrids with 1-50g/km use electric range bands
  if ((fuelType === 'hybrid_petrol' || fuelType === 'hybrid_diesel') && co2 <= 50) {
    const rangeMiles = electricRangeKm ? Math.floor(electricRangeKm * 0.621371) : 0;
    for (const band of P11DRates2024.ELECTRIC_RANGE_BANDS) {
      if (rangeMiles >= band.range) {
        return band.percentage;
      }
    }
    return 0.14; // Default for under 30 miles
  }

  // Standard CO2 bands
  let percentage = 0.02; // Minimum
  for (const band of P11DRates2024.CO2_BANDS) {
    if (co2 >= band.co2) {
      percentage = band.percentage;
    }
  }
  return percentage;
}

// =============================================================================
// Fuel Benefit Calculator
// =============================================================================

export interface FuelBenefitInput {
  co2Emissions: number;
  fuelType: 'petrol' | 'diesel' | 'hybrid_petrol' | 'hybrid_diesel';
  electricRangeKm?: number;
  dateAvailableFrom: Date;
  dateAvailableTo?: Date;
  fuelWithdrawnDate?: Date;
  taxYearStart: Date;
  taxYearEnd: Date;
}

export interface FuelBenefitResult {
  fuelMultiplier: string;
  appropriatePercentage: string;
  annualBenefit: string;
  proportionedBenefit: string;
  cashEquivalent: string;
  daysAvailable: number;
}

export function calculateFuelBenefit(input: FuelBenefitInput): FuelBenefitResult {
  const {
    co2Emissions,
    fuelType,
    electricRangeKm,
    dateAvailableFrom,
    dateAvailableTo,
    fuelWithdrawnDate,
    taxYearStart,
    taxYearEnd,
  } = input;

  // Use same percentage as car
  let basePercentage = getBaseCO2Percentage(co2Emissions, fuelType, electricRangeKm);
  let dieselSupplement = 0;
  if (fuelType === 'diesel' || fuelType === 'hybrid_diesel') {
    dieselSupplement = P11DRates2024.DIESEL_SUPPLEMENT;
  }
  const finalPercentage = Math.min(
    basePercentage + dieselSupplement,
    P11DRates2024.MAX_CAR_BENEFIT_PERCENTAGE
  );

  // Calculate annual fuel benefit
  const fuelMultiplier = new Decimal(P11DRates2024.CAR_FUEL_MULTIPLIER);
  const annualBenefit = fuelMultiplier.mul(finalPercentage);

  // Calculate days available (fuel benefit ends if fuel withdrawn)
  const effectiveEndDate = fuelWithdrawnDate && fuelWithdrawnDate < (dateAvailableTo || taxYearEnd)
    ? fuelWithdrawnDate
    : (dateAvailableTo || taxYearEnd);

  const yearStart = dateAvailableFrom > taxYearStart ? dateAvailableFrom : taxYearStart;
  const yearEnd = effectiveEndDate < taxYearEnd ? effectiveEndDate : taxYearEnd;
  const daysAvailable = Math.max(0, Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // Proportion for part year
  const proportion = new Decimal(daysAvailable).div(365);
  const proportionedBenefit = annualBenefit.mul(proportion);

  return {
    fuelMultiplier: fuelMultiplier.toFixed(2),
    appropriatePercentage: (finalPercentage * 100).toFixed(0) + '%',
    annualBenefit: annualBenefit.toFixed(2),
    proportionedBenefit: proportionedBenefit.toFixed(2),
    cashEquivalent: proportionedBenefit.toFixed(2),
    daysAvailable,
  };
}

// =============================================================================
// Loan Benefit Calculator
// =============================================================================

export interface LoanBenefitInput {
  loanAmount: string;
  maximumBalanceInYear: string;
  balanceAtYearEnd: string;
  interestRateCharged: string; // Rate charged to employee
  averageMethod?: boolean; // Use average balance method
}

export interface LoanBenefitResult {
  averageBalance: string;
  officialInterest: string;
  interestPaidByEmployee: string;
  cashEquivalent: string;
  exemptionApplied: boolean;
}

export function calculateLoanBenefit(input: LoanBenefitInput): LoanBenefitResult {
  const {
    loanAmount,
    maximumBalanceInYear,
    balanceAtYearEnd,
    interestRateCharged,
    averageMethod = true,
  } = input;

  const maxBalance = new Decimal(maximumBalanceInYear);
  const endBalance = new Decimal(balanceAtYearEnd);
  const interestRate = new Decimal(interestRateCharged);
  const officialRate = new Decimal(P11DRates2024.OFFICIAL_INTEREST_RATE);

  // Check if exempt (total loans under £10,000)
  if (maxBalance.lte(P11DRates2024.LOAN_EXEMPTION_THRESHOLD)) {
    return {
      averageBalance: '0.00',
      officialInterest: '0.00',
      interestPaidByEmployee: '0.00',
      cashEquivalent: '0.00',
      exemptionApplied: true,
    };
  }

  // Calculate average balance (simplified - would need actual method in production)
  const averageBalance = averageMethod
    ? maxBalance.plus(endBalance).div(2)
    : maxBalance;

  // Calculate interest at official rate
  const officialInterest = averageBalance.mul(officialRate);

  // Calculate interest actually paid by employee
  const interestPaidByEmployee = averageBalance.mul(interestRate);

  // Benefit is the difference
  const cashEquivalent = Decimal.max(officialInterest.minus(interestPaidByEmployee), 0);

  return {
    averageBalance: averageBalance.toFixed(2),
    officialInterest: officialInterest.toFixed(2),
    interestPaidByEmployee: interestPaidByEmployee.toFixed(2),
    cashEquivalent: cashEquivalent.toFixed(2),
    exemptionApplied: false,
  };
}

// =============================================================================
// Van Benefit Calculator
// =============================================================================

export interface VanBenefitInput {
  isZeroEmission: boolean;
  fuelProvidedForPrivateUse: boolean;
  dateAvailableFrom: Date;
  dateAvailableTo?: Date;
  taxYearStart: Date;
  taxYearEnd: Date;
}

export interface VanBenefitResult {
  vanBenefit: string;
  fuelBenefit: string;
  totalBenefit: string;
  daysAvailable: number;
}

export function calculateVanBenefit(input: VanBenefitInput): VanBenefitResult {
  const {
    isZeroEmission,
    fuelProvidedForPrivateUse,
    dateAvailableFrom,
    dateAvailableTo,
    taxYearStart,
    taxYearEnd,
  } = input;

  // Calculate days available
  const yearStart = dateAvailableFrom > taxYearStart ? dateAvailableFrom : taxYearStart;
  const yearEnd = dateAvailableTo && dateAvailableTo < taxYearEnd ? dateAvailableTo : taxYearEnd;
  const daysAvailable = Math.max(0, Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const proportion = new Decimal(daysAvailable).div(365);

  // Van benefit
  const annualVanBenefit = isZeroEmission
    ? new Decimal(P11DRates2024.ZERO_EMISSION_VAN_BENEFIT)
    : new Decimal(P11DRates2024.VAN_BENEFIT);
  const vanBenefit = annualVanBenefit.mul(proportion);

  // Fuel benefit (only if not zero emission and fuel provided)
  let fuelBenefit = new Decimal(0);
  if (!isZeroEmission && fuelProvidedForPrivateUse) {
    fuelBenefit = new Decimal(P11DRates2024.VAN_FUEL_BENEFIT).mul(proportion);
  }

  return {
    vanBenefit: vanBenefit.toFixed(2),
    fuelBenefit: fuelBenefit.toFixed(2),
    totalBenefit: vanBenefit.plus(fuelBenefit).toFixed(2),
    daysAvailable,
  };
}

// =============================================================================
// P11D Summary Calculator
// =============================================================================

export function calculateP11DSummary(p11d: Partial<P11DRecord>): P11DSummary {
  let sectionATotalCashEquivalent = new Decimal(0);
  let sectionBTotalPayments = new Decimal(0);
  let sectionCTotalVouchers = new Decimal(0);
  let sectionDTotalAccommodation = new Decimal(0);
  let sectionEExcessMileage = new Decimal(0);
  let sectionFTotalCars = new Decimal(0);
  let sectionFTotalFuel = new Decimal(0);
  let sectionGTotalVans = new Decimal(0);
  let sectionGTotalVanFuel = new Decimal(0);
  let sectionHTotalLoans = new Decimal(0);
  let sectionITotalMedical = new Decimal(0);
  let sectionJTaxableRelocation = new Decimal(0);
  let sectionKTotalServices = new Decimal(0);
  let sectionLTotalAssets = new Decimal(0);
  let sectionMTotalOther = new Decimal(0);
  let sectionNTotalExpenses = new Decimal(0);

  // Section A - Assets transferred
  if (p11d.sectionA) {
    for (const item of p11d.sectionA) {
      sectionATotalCashEquivalent = sectionATotalCashEquivalent.plus(item.cashEquivalent);
    }
  }

  // Section B - Payments on behalf
  if (p11d.sectionB) {
    for (const item of p11d.sectionB) {
      sectionBTotalPayments = sectionBTotalPayments.plus(item.amount);
    }
  }

  // Section C - Vouchers
  if (p11d.sectionC) {
    sectionCTotalVouchers = new Decimal(p11d.sectionC.totalVouchersCreditCards);
  }

  // Section D - Accommodation
  if (p11d.sectionD) {
    sectionDTotalAccommodation = new Decimal(p11d.sectionD.cashEquivalent);
  }

  // Section E - Mileage
  if (p11d.sectionE) {
    sectionEExcessMileage = new Decimal(p11d.sectionE.excessOverApprovedAmount);
  }

  // Section F - Cars and fuel
  if (p11d.sectionF) {
    sectionFTotalCars = new Decimal(p11d.sectionF.totalCarBenefit);
    sectionFTotalFuel = new Decimal(p11d.sectionF.totalFuelBenefit);
  }

  // Section G - Vans
  if (p11d.sectionG) {
    sectionGTotalVans = new Decimal(p11d.sectionG.totalVanBenefit);
    sectionGTotalVanFuel = new Decimal(p11d.sectionG.totalVanFuelBenefit);
  }

  // Section H - Loans
  if (p11d.sectionH) {
    sectionHTotalLoans = new Decimal(p11d.sectionH.totalCashEquivalent);
  }

  // Section I - Medical
  if (p11d.sectionI) {
    sectionITotalMedical = new Decimal(p11d.sectionI.cashEquivalent);
  }

  // Section J - Relocation
  if (p11d.sectionJ) {
    sectionJTaxableRelocation = new Decimal(p11d.sectionJ.taxableExcess);
  }

  // Section K - Services
  if (p11d.sectionK) {
    for (const item of p11d.sectionK) {
      sectionKTotalServices = sectionKTotalServices.plus(item.cashEquivalent);
    }
  }

  // Section L - Assets available
  if (p11d.sectionL) {
    sectionLTotalAssets = new Decimal(p11d.sectionL.totalCashEquivalent);
  }

  // Section M - Other
  if (p11d.sectionM) {
    sectionMTotalOther = new Decimal(p11d.sectionM.totalTaxableAmount);
  }

  // Section N - Expenses
  if (p11d.sectionN) {
    sectionNTotalExpenses = new Decimal(p11d.sectionN.totalExpenses);
  }

  // Calculate total
  const totalBenefitsAndExpenses = sectionATotalCashEquivalent
    .plus(sectionBTotalPayments)
    .plus(sectionCTotalVouchers)
    .plus(sectionDTotalAccommodation)
    .plus(sectionEExcessMileage)
    .plus(sectionFTotalCars)
    .plus(sectionFTotalFuel)
    .plus(sectionGTotalVans)
    .plus(sectionGTotalVanFuel)
    .plus(sectionHTotalLoans)
    .plus(sectionITotalMedical)
    .plus(sectionJTaxableRelocation)
    .plus(sectionKTotalServices)
    .plus(sectionLTotalAssets)
    .plus(sectionMTotalOther)
    .plus(sectionNTotalExpenses);

  // Calculate Class 1A NIC
  const class1ANICDue = totalBenefitsAndExpenses.mul(P11DRates2024.CLASS_1A_NIC_RATE);

  return {
    sectionATotalCashEquivalent: sectionATotalCashEquivalent.toFixed(2),
    sectionBTotalPayments: sectionBTotalPayments.toFixed(2),
    sectionCTotalVouchers: sectionCTotalVouchers.toFixed(2),
    sectionDTotalAccommodation: sectionDTotalAccommodation.toFixed(2),
    sectionEExcessMileage: sectionEExcessMileage.toFixed(2),
    sectionFTotalCars: sectionFTotalCars.toFixed(2),
    sectionFTotalFuel: sectionFTotalFuel.toFixed(2),
    sectionGTotalVans: sectionGTotalVans.toFixed(2),
    sectionGTotalVanFuel: sectionGTotalVanFuel.toFixed(2),
    sectionHTotalLoans: sectionHTotalLoans.toFixed(2),
    sectionITotalMedical: sectionITotalMedical.toFixed(2),
    sectionJTaxableRelocation: sectionJTaxableRelocation.toFixed(2),
    sectionKTotalServices: sectionKTotalServices.toFixed(2),
    sectionLTotalAssets: sectionLTotalAssets.toFixed(2),
    sectionMTotalOther: sectionMTotalOther.toFixed(2),
    sectionNTotalExpenses: sectionNTotalExpenses.toFixed(2),
    totalBenefitsAndExpenses: totalBenefitsAndExpenses.toFixed(2),
    class1ANICDue: class1ANICDue.toFixed(2),
  };
}
