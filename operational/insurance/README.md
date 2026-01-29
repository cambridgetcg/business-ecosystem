# Insurance

Risk transfer, policy management, and claims administration.

## Subdomains

### policy-management
Insurance policy tracking and administration.
- `insurance-policy.ts` - Policy master records
- `policy-type.ts` - GL, professional, property, cyber, etc.
- `coverage.ts` - Coverage details and limits
- `coverage-limit.ts` - Per-occurrence and aggregate limits
- `deductible.ts` - Deductible structures
- `policy-term.ts` - Effective dates and terms
- `renewal.ts` - Renewal tracking
- `endorsement.ts` - Policy modifications

### general-liability
Commercial general liability coverage.
- `gl-policy.ts` - GL policy details
- `occurrence-limit.ts` - Per-occurrence limits
- `aggregate-limit.ts` - Annual aggregate limits
- `coi.ts` - Certificate of Insurance
- `additional-insured.ts` - Additional insured endorsements

### professional-liability
Management and professional coverage.
- `eo-policy.ts` - Errors & Omissions coverage
- `do-policy.ts` - Directors & Officers liability
- `epli-policy.ts` - Employment Practices Liability
- `fiduciary-policy.ts` - Fiduciary liability
- `retroactive-date.ts` - Prior acts coverage dates

### property-insurance
Asset and business interruption coverage.
- `property-policy.ts` - Property coverage details
- `covered-property.ts` - Scheduled property
- `business-interruption.ts` - BI coverage
- `contingent-bi.ts` - Contingent business interruption
- `extra-expense.ts` - Extra expense coverage
- `property-schedule.ts` - Asset schedules

### workers-compensation
Employee injury coverage.
- `wc-policy.ts` - Workers comp policy
- `experience-mod.ts` - Experience modification rate
- `class-code.ts` - NCCI class codes
- `payroll-audit.ts` - Premium audit records
- `state-coverage.ts` - State-specific coverage

### cyber-insurance
Cyber liability and data breach coverage.
- `cyber-policy.ts` - Cyber policy details
- `data-breach-coverage.ts` - First and third-party breach
- `network-security.ts` - Network security liability
- `privacy-liability.ts` - Privacy violation coverage
- `media-liability.ts` - Media content coverage
- `cyber-extortion.ts` - Ransomware coverage

### product-liability
Product defect and recall coverage.
- `product-policy.ts` - Product liability coverage
- `product-recall.ts` - Recall expense coverage
- `completed-operations.ts` - Completed ops coverage
- `product-schedule.ts` - Covered product listing

### claims-management
Insurance claim filing and tracking.
- `claim.ts` - Claim records
- `claim-status.ts` - Claim lifecycle status
- `claim-reserve.ts` - Reserve estimates
- `adjuster.ts` - Adjuster assignments
- `settlement.ts` - Settlement records
- `subrogation.ts` - Subrogation recovery

## External Integrations

- **broker-portals/**: Insurance broker platforms
- **carrier-apis/**: Direct carrier integrations

## Key Integrations

- **contracts-legal**: Policy documents as contracts
- **accounting**: Premium and claim accounting
- **corporate-security**: Loss prevention coordination
- **compliance**: Insurance compliance requirements
