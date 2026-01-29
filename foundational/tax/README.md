# Tax

Tax compliance, planning, and reporting across all jurisdictions.

## Subdomains

### tax-registration
Tax registrations and nexus management.
- `tax-id.ts` - EIN, VAT numbers, tax IDs
- `vat-registration.ts` - VAT/GST registrations
- `nexus-determination.ts` - Tax nexus analysis
- `tax-jurisdiction.ts` - Taxing authority records
- `registration-status.ts` - Active registrations

### income-tax
Corporate income tax compliance.
- `tax-return.ts` - Federal, state, foreign returns
- `taxable-income.ts` - Book-to-tax adjustments
- `tax-liability.ts` - Current tax obligations
- `estimated-payment.ts` - Quarterly estimates
- `extension.ts` - Filing extensions
- `carryforward.ts` - NOL and credit carryforwards

### sales-vat-tax
Indirect tax compliance.
- `sales-tax-rate.ts` - Jurisdiction rates
- `vat-rate.ts` - VAT/GST rates
- `tax-calculation.ts` - Transaction tax calculations
- `exemption-certificate.ts` - Customer exemptions
- `tax-remittance.ts` - Tax payment records
- `vat-return.ts` - VAT return filings

### payroll-tax
Employment tax compliance.
- `withholding.ts` - Employee withholdings
- `employer-contribution.ts` - FICA, FUTA, state taxes
- `payroll-tax-deposit.ts` - Deposit schedules
- `form-w2.ts` - Annual wage statements
- `form-1099.ts` - Non-employee compensation
- `payroll-tax-return.ts` - Quarterly/annual filings

### transfer-pricing
Intercompany pricing compliance.
- `intercompany-transaction.ts` - IC transaction records
- `transfer-pricing-policy.ts` - Pricing methodologies
- `benchmark-study.ts` - Comparable analysis
- `comparable-analysis.ts` - Arm's length testing
- `documentation.ts` - TP documentation
- `country-by-country-report.ts` - CbCR filings

### tax-planning
Tax strategy and optimization.
- `tax-strategy.ts` - Tax planning initiatives
- `tax-credit.ts` - R&D, foreign tax credits
- `tax-incentive.ts` - Economic development incentives
- `structure-optimization.ts` - Entity structure planning
- `tax-scenario.ts` - What-if analysis

### tax-provision
Financial statement tax accounting.
- `tax-provision.ts` - ASC 740 calculations
- `deferred-tax-asset.ts` - DTA tracking
- `deferred-tax-liability.ts` - DTL tracking
- `valuation-allowance.ts` - VA assessments
- `uncertain-tax-position.ts` - FIN 48 / ASC 740-10
- `effective-tax-rate.ts` - ETR analysis

### tax-audit
Tax controversy and examination support.
- `tax-examination.ts` - IRS/state audits
- `audit-issue.ts` - Examination issues
- `irs-notice.ts` - IRS correspondence
- `audit-response.ts` - Formal responses
- `settlement.ts` - Audit settlements

## External Integrations

- **tax-engines/**: Avalara, Vertex, Thomson Reuters ONESOURCE
- **filing-services/**: E-filing providers, state portals

## Key Integrations

- **accounting**: Tax provision entries, tax accounts
- **entity-governance**: Entity structure, nexus
- **banking-treasury**: Tax payments
- **compliance**: Tax compliance calendar
