/**
 * CT600 Preparation Service
 *
 * Prepares CT600 Corporation Tax return data from a CorporationTaxPeriod.
 * Maps period data to HMRC CT600 box format.
 */

import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import type { CorporationTaxPeriod } from '../models/period.js';
import type {
  CT600Return,
  CT600Core,
  CT600PreparationInput,
  CT600ValidationResult,
} from '../models/ct600.js';

// =============================================================================
// CT600 Preparation Service
// =============================================================================

export class CT600PreparationService {
  /**
   * Prepare a CT600 return from a calculated Corporation Tax period
   */
  prepareCT600(input: CT600PreparationInput): CT600Return {
    const { period, companyInfo, declarant, supplementaryPages } = input;

    // Validate period is calculated
    if (period.status === 'draft') {
      throw new Error('Cannot prepare CT600 for uncalculated period');
    }

    const now = new Date();

    // Calculate net trading profits
    const tradingProfits = new Decimal(period.tradingProfits);
    const tradingLossesBF = new Decimal(period.tradingLossesBroughtForward);
    const tradingLossesCB = new Decimal(period.tradingLossesCarriedBack);
    const netTradingProfits = Decimal.max(
      tradingProfits.minus(tradingLossesBF).minus(tradingLossesCB),
      0
    );

    // Calculate net chargeable gains
    const chargeableGains = new Decimal(period.chargeableGains);
    const capitalLossesUsed = new Decimal(period.capitalLossesUsed);
    const netChargeableGains = chargeableGains.minus(capitalLossesUsed);

    // Calculate gross CT (before reliefs)
    const ctLiability = new Decimal(period.corporationTaxLiability);
    const rdCredits = new Decimal(period.rdTaxCredits || '0');
    const foreignCredit = new Decimal(period.foreignTaxCredit || '0');
    const otherCredits = new Decimal(period.otherCredits || '0');
    const totalCredits = rdCredits.plus(foreignCredit).plus(otherCredits);
    const grossCT = ctLiability.plus(totalCredits);

    // Determine if repayable or payable
    const taxDue = new Decimal(period.taxDue);
    const taxPaid = new Decimal(period.taxPaid);
    const taxOutstanding = new Decimal(period.taxOutstanding);
    const isRepayable = taxOutstanding.lt(0);

    // Build core return
    const core: CT600Core = {
      // Company Information
      box1_companyName: companyInfo.companyName,
      box2_companyUTR: companyInfo.utr,
      box3_taxReference: companyInfo.taxReference,
      box4_companyRegistrationNumber: companyInfo.registrationNumber,
      box5_registeredOffice: companyInfo.registeredOffice,
      box6_tradingName: companyInfo.tradingName,

      // Accounting Period
      box30_periodStart: period.periodStart,
      box31_periodEnd: period.periodEnd,

      // Trading Profits
      box145_tradingProfits: period.tradingProfits,
      box155_tradingLosses: tradingLossesBF.plus(tradingLossesCB).toFixed(2),
      box160_netTradingProfits: netTradingProfits.toFixed(2),

      // Non-Trading Income
      box190_loanRelationshipsNonTrading: period.investmentIncome,
      box195_intangibleAssetsIncome: '0.00',
      box200_propertyIncome: period.propertyIncome,
      box205_otherIncome: period.otherIncome,

      // Chargeable Gains
      box220_chargeableGains: period.chargeableGains,
      box225_capitalLossesBroughtForward: period.capitalLossesUsed,
      box235_netChargeableGains: netChargeableGains.toFixed(2),

      // Total Profits
      box275_grossProfits: period.totalProfitsBeforeDeductions,

      // Deductions
      box305_tradingLossesRelief: period.tradingLossesRelief,
      box310_nontradingDeficits: '0.00',
      box315_groupRelief: period.groupRelief,
      box320_managementExpenses: period.managementExpenses,
      box325_qualifyingDonations: period.qualifyingCharitableDonations,

      // Profits Chargeable to CT
      box360_profitsChargeableToCT: period.profitsChargeableToCT,
      box365_financialYear1: period.profitsChargeableToCT,
      box370_financialYear2: undefined,

      // Tax Calculation
      box380_ctAtMainRate: period.mainRateAmount,
      box385_ctAtSmallProfitsRate: period.smallProfitsRateAmount,
      box390_marginalRelief: period.marginalReliefAmount,
      box400_grossCT: grossCT.toFixed(2),
      box405_doubleTaxRelief: '0.00',
      box410_underlyingTaxOnDividends: '0.00',
      box415_foreignTaxCredit: period.foreignTaxCredit || '0.00',
      box430_netCT: period.corporationTaxLiability,

      // Additional Claims
      box440_rdTaxCredit: period.rdTaxCredits || '0.00',
      box445_creativeTaxCredit: '0.00',
      box470_communityInvestmentRelief: '0.00',
      box475_investmentZoneRelief: '0.00',

      // Final Tax Due
      box505_ctOutstanding: isRepayable ? '0.00' : taxOutstanding.toFixed(2),
      box510_ctRepayable: isRepayable ? taxOutstanding.abs().toFixed(2) : '0.00',
      box515_instalmentPayments: taxPaid.toFixed(2),
      box520_taxPayable: isRepayable ? '0.00' : taxOutstanding.toFixed(2),
      box525_bankAccountForRepayment: undefined,

      // Declaration
      box600_declaration: true,
      box605_declarantName: declarant.name,
      box610_declarantStatus: declarant.status,
      box615_declarationDate: now,
    };

    // Build CT600 return
    const ct600Return: CT600Return = {
      id: randomUUID(),
      periodId: period.id,
      tenantId: period.tenantId,
      entityId: period.entityId,
      version: 1,
      status: 'draft',
      core,
      createdAt: now,
      updatedAt: now,
    };

    // Add supplementary pages if specified
    if (supplementaryPages?.ct600c) {
      ct600Return.ct600c = {
        included: true,
        claimingGroupRelief: new Decimal(period.groupRelief).gt(0),
        surrenderingGroupRelief: false,
        groupReliefClaimed: period.groupRelief,
        consortiumRelief: false,
        ...supplementaryPages.ct600c,
      };
    }

    if (supplementaryPages?.ct600j || (period.rdTaxCredits && new Decimal(period.rdTaxCredits).gt(0))) {
      ct600Return.ct600j = {
        included: true,
        smeScheme: true,
        rdecScheme: false,
        rdTaxCredit: period.rdTaxCredits,
        ...supplementaryPages?.ct600j,
      };
    }

    if (supplementaryPages?.ct600l) {
      ct600Return.ct600l = {
        included: true,
        lossesAtPeriodStart: period.tradingLossesBroughtForward,
        lossesUsedAgainstProfits: period.tradingLossesRelief,
        ...supplementaryPages.ct600l,
      };
    }

    // Add attachments info
    if (input.includeComputations) {
      ct600Return.computations = {
        included: true,
        fileRef: undefined,
      };
    }

    if (input.includeAccounts) {
      ct600Return.accounts = {
        included: true,
        iXBRL: true,
        fileRef: undefined,
      };
    }

    return ct600Return;
  }

  /**
   * Validate a CT600 return before submission
   */
  validateCT600(ct600: CT600Return): CT600ValidationResult {
    const errors: CT600ValidationResult['errors'] = [];
    const warnings: CT600ValidationResult['warnings'] = [];

    // Required field validations
    if (!ct600.core.box1_companyName) {
      errors.push({ box: 'box1', message: 'Company name is required', severity: 'error' });
    }

    if (!ct600.core.box2_companyUTR || ct600.core.box2_companyUTR.length !== 10) {
      errors.push({ box: 'box2', message: 'Valid 10-digit UTR is required', severity: 'error' });
    }

    if (!ct600.core.box5_registeredOffice) {
      errors.push({ box: 'box5', message: 'Registered office address is required', severity: 'error' });
    }

    // Period validations
    const periodStart = ct600.core.box30_periodStart;
    const periodEnd = ct600.core.box31_periodEnd;
    if (periodStart >= periodEnd) {
      errors.push({ box: 'box30-31', message: 'Period end must be after period start', severity: 'error' });
    }

    const diffDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      errors.push({ box: 'box30-31', message: 'Accounting period cannot exceed 12 months', severity: 'error' });
    }

    // Box 3 calculations should equal Box 5
    const box3 = new Decimal(ct600.core.box400_grossCT);
    const box5 = new Decimal(ct600.core.box430_netCT)
      .plus(ct600.core.box440_rdTaxCredit)
      .plus(ct600.core.box415_foreignTaxCredit);

    if (!box3.minus(box5).abs().lte(0.01)) {
      warnings.push({ box: 'box400-430', message: 'Gross CT minus credits should equal Net CT' });
    }

    // Declaration validations
    if (!ct600.core.box600_declaration) {
      errors.push({ box: 'box600', message: 'Declaration must be accepted', severity: 'error' });
    }

    if (!ct600.core.box605_declarantName) {
      errors.push({ box: 'box605', message: 'Declarant name is required', severity: 'error' });
    }

    // Check for supplementary pages when conditions suggest they're needed
    const groupRelief = new Decimal(ct600.core.box315_groupRelief);
    if (groupRelief.gt(0) && !ct600.ct600c?.included) {
      warnings.push({ box: 'CT600C', message: 'Group relief claimed but CT600C not included' });
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate XML representation for HMRC submission
   * (Simplified - full implementation would use HMRC's XML schema)
   */
  generateXML(ct600: CT600Return): string {
    // In production, this would generate proper HMRC-compliant XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<CT600>
  <CompanyInformation>
    <CompanyName>${ct600.core.box1_companyName}</CompanyName>
    <UTR>${ct600.core.box2_companyUTR}</UTR>
    <TaxReference>${ct600.core.box3_taxReference || ''}</TaxReference>
    <CompanyRegistrationNumber>${ct600.core.box4_companyRegistrationNumber || ''}</CompanyRegistrationNumber>
    <RegisteredOffice>${ct600.core.box5_registeredOffice}</RegisteredOffice>
  </CompanyInformation>
  <AccountingPeriod>
    <Start>${ct600.core.box30_periodStart.toISOString().split('T')[0]}</Start>
    <End>${ct600.core.box31_periodEnd.toISOString().split('T')[0]}</End>
  </AccountingPeriod>
  <ProfitsChargeableToCT>${ct600.core.box360_profitsChargeableToCT}</ProfitsChargeableToCT>
  <CorporationTaxLiability>${ct600.core.box430_netCT}</CorporationTaxLiability>
  <TaxPayable>${ct600.core.box520_taxPayable}</TaxPayable>
  <Declaration>
    <Accepted>${ct600.core.box600_declaration}</Accepted>
    <Name>${ct600.core.box605_declarantName}</Name>
    <Status>${ct600.core.box610_declarantStatus}</Status>
    <Date>${ct600.core.box615_declarationDate.toISOString().split('T')[0]}</Date>
  </Declaration>
</CT600>`;
  }

  /**
   * Generate computation document for CT600
   */
  generateComputations(ct600: CT600Return): string {
    const core = ct600.core;
    return `
CORPORATION TAX COMPUTATION
===========================
Company: ${core.box1_companyName}
UTR: ${core.box2_companyUTR}
Period: ${core.box30_periodStart.toISOString().split('T')[0]} to ${core.box31_periodEnd.toISOString().split('T')[0]}

TRADING PROFITS
---------------
Trading profits                          ${core.box145_tradingProfits}
Less: Trading losses                    (${core.box155_tradingLosses})
                                        ──────────
Net trading profits                      ${core.box160_netTradingProfits}

NON-TRADING INCOME
------------------
Loan relationships                       ${core.box190_loanRelationshipsNonTrading}
Property income                          ${core.box200_propertyIncome}
Other income                             ${core.box205_otherIncome}

CHARGEABLE GAINS
----------------
Chargeable gains                         ${core.box220_chargeableGains}
Less: Capital losses used               (${core.box225_capitalLossesBroughtForward})
                                        ──────────
Net chargeable gains                     ${core.box235_netChargeableGains}

TOTAL PROFITS
-------------
Gross profits                            ${core.box275_grossProfits}

DEDUCTIONS
----------
Losses against profits                  (${core.box305_tradingLossesRelief})
Group relief                            (${core.box315_groupRelief})
Management expenses                     (${core.box320_managementExpenses})
Qualifying donations                    (${core.box325_qualifyingDonations})
                                        ──────────
Profits chargeable to CT                 ${core.box360_profitsChargeableToCT}

TAX CALCULATION
---------------
CT at main rate                          ${core.box380_ctAtMainRate}
CT at small profits rate                 ${core.box385_ctAtSmallProfitsRate}
Less: Marginal relief                   (${core.box390_marginalRelief})
                                        ──────────
Gross CT                                 ${core.box400_grossCT}

Less: Tax credits
  R&D tax credit                        (${core.box440_rdTaxCredit})
  Foreign tax credit                    (${core.box415_foreignTaxCredit})
                                        ──────────
Net CT                                   ${core.box430_netCT}

TAX PAYABLE
-----------
Tax due                                  ${core.box505_ctOutstanding}
Less: Instalment payments               (${core.box515_instalmentPayments})
                                        ──────────
Tax payable                              ${core.box520_taxPayable}
`.trim();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createCT600PreparationService(): CT600PreparationService {
  return new CT600PreparationService();
}
