# Tax Service

UK Tax compliance, calculation, and HMRC MTD submission service.

## Overview

The Tax Service handles UK tax compliance including:
- **Corporation Tax**: CT600 returns with marginal relief calculations
- **VAT (MTD)**: Making Tax Digital compliant VAT returns
- **PAYE/NI**: Employee payroll tax and National Insurance
- **HMRC Integration**: OAuth 2.0 and API submission to HMRC

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## API Reference

### Base URL
```
/api/v1/tax
```

---

## Tax Registrations

Manage entity tax registrations with HMRC (UTR, VAT, PAYE).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/registrations` | List tax registrations |
| `GET` | `/registrations/:id` | Get registration by ID |
| `POST` | `/registrations` | Create new registration |
| `PUT` | `/registrations/:id` | Update registration |
| `DELETE` | `/registrations/:id` | Delete registration |
| `POST` | `/registrations/:id/vat` | Register for VAT |
| `POST` | `/registrations/:id/paye` | Register for PAYE |

### Create Registration

```http
POST /api/v1/tax/registrations
Content-Type: application/json

{
  "tenantId": "uuid",
  "entityId": "uuid",
  "utr": "1234567890",
  "companyName": "Example Ltd",
  "registeredAddress": {
    "line1": "123 High Street",
    "city": "London",
    "postcode": "SW1A 1AA",
    "country": "GB"
  },
  "accountingPeriodEnd": "2025-03-31"
}
```

---

## Corporation Tax

UK Corporation Tax calculations with FY2023/24+ rates.

### Tax Rates (FY2023/24+)
- **Small Profits Rate**: 19% (profits ≤ £50,000)
- **Main Rate**: 25% (profits > £250,000)
- **Marginal Relief**: 3/200 fraction for profits between thresholds

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/corporation-tax/periods` | List CT periods |
| `GET` | `/corporation-tax/periods/:id` | Get CT period |
| `POST` | `/corporation-tax/periods` | Create CT period |
| `PUT` | `/corporation-tax/periods/:id` | Update CT period |
| `POST` | `/corporation-tax/periods/:id/calculate` | Calculate CT liability |
| `POST` | `/corporation-tax/periods/:id/file` | Mark as filed |
| `POST` | `/corporation-tax/periods/:id/pay` | Record payment |

### Calculate Corporation Tax

```http
POST /api/v1/tax/corporation-tax/calculate
Content-Type: application/json

{
  "profits": 150000,
  "associatedCompanies": 0
}
```

**Response**:
```json
{
  "profits": "150000.00",
  "rateApplied": "marginal",
  "tax": "36000.00",
  "marginalRelief": "1500.00",
  "effectiveRate": "0.2400"
}
```

---

## VAT (Making Tax Digital)

MTD-compliant VAT returns with 9-box format.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/vat/returns` | List VAT returns |
| `GET` | `/vat/returns/:id` | Get VAT return |
| `POST` | `/vat/returns` | Create VAT return |
| `PUT` | `/vat/returns/:id` | Update VAT return |
| `POST` | `/vat/returns/:id/calculate` | Calculate 9-box values |
| `POST` | `/vat/returns/:id/accept-declaration` | Accept legal declaration |
| `POST` | `/vat/returns/:id/submit` | Submit to HMRC |

### VAT 9-Box Return

| Box | Description |
|-----|-------------|
| Box 1 | VAT due on sales |
| Box 2 | VAT due on acquisitions |
| Box 3 | Total VAT due (Box 1 + Box 2) |
| Box 4 | VAT reclaimed on purchases |
| Box 5 | Net VAT (Box 3 - Box 4) |
| Box 6 | Total value of sales (ex. VAT) |
| Box 7 | Total value of purchases (ex. VAT) |
| Box 8 | Total value of EU supplies (ex. VAT) |
| Box 9 | Total value of EU acquisitions (ex. VAT) |

### Calculate VAT Return

```http
POST /api/v1/tax/vat/returns/:id/calculate
Content-Type: application/json

{
  "transactions": [
    {
      "type": "sale",
      "netAmount": "10000.00",
      "vatAmount": "2000.00",
      "rateType": "standard"
    },
    {
      "type": "purchase",
      "netAmount": "5000.00",
      "vatAmount": "1000.00",
      "rateType": "standard"
    }
  ]
}
```

---

## PAYE & National Insurance

Employee payroll tax and NI calculations with RTI submission support.

### Tax Regions

| Region | Tax Code Prefix | Bands |
|--------|-----------------|-------|
| England/NI | (none) | Basic (20%), Higher (40%), Additional (45%) |
| Scotland | S | Starter (19%), Basic (20%), Intermediate (21%), Higher (42%), Top (47%) |
| Wales | C | Basic (20%), Higher (40%), Additional (45%) |

### NI Categories

| Category | Description | Employee Rate | Employer Rate |
|----------|-------------|---------------|---------------|
| A | Standard | 8% (PT-UEL), 2% (>UEL) | 13.8% |
| B | Married women's reduced | 5.85% | 13.8% |
| C | Over State Pension age | 0% | 13.8% |
| H | Apprentice under 25 | 8% | 0% (up to AUST) |
| M | Under 21 | 8% | 0% (up to UST) |
| J | Deferment | 2% | 13.8% |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/paye/fps` | List FPS submissions |
| `POST` | `/paye/fps` | Create FPS submission |
| `POST` | `/paye/fps/:id/submit` | Submit FPS to HMRC |
| `GET` | `/paye/eps` | List EPS submissions |
| `POST` | `/paye/eps` | Create EPS submission |
| `POST` | `/paye/eps/:id/submit` | Submit EPS to HMRC |
| `GET` | `/paye/employees` | List employee tax records |
| `POST` | `/paye/employees` | Create employee tax record |
| `POST` | `/paye/employees/:id/tax-code` | Change tax code |
| `POST` | `/paye/employees/:id/p45` | Issue P45 |
| `POST` | `/paye/employees/:id/p60` | Issue P60 |

### Calculation Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/paye/calculate/ni` | Calculate NI contributions |
| `POST` | `/paye/calculate/paye` | Calculate PAYE tax |
| `POST` | `/paye/calculate/student-loan` | Calculate student loan deductions |

### Calculate PAYE

```http
POST /api/v1/tax/paye/calculate/paye
Content-Type: application/json

{
  "grossPay": "4000.00",
  "taxCode": "S1257L",
  "periodNumber": 1,
  "frequency": "monthly",
  "taxPaidToDate": "0",
  "taxablePayToDate": "0"
}
```

**Response**:
```json
{
  "grossPay": "4000.00",
  "taxablePay": "2952.50",
  "taxDue": "573.67",
  "taxDeducted": "573.67",
  "taxRegion": "scotland",
  "breakdown": {
    "starterRateTax": "36.51",
    "basicRateTax": "194.21",
    "intermediateRateTax": "0.00",
    "higherRateTax": "0.00",
    "additionalRateTax": "0.00",
    "allowanceUsed": "1047.50"
  }
}
```

### Calculate NI

```http
POST /api/v1/tax/paye/calculate/ni
Content-Type: application/json

{
  "pay": "3000.00",
  "category": "A",
  "frequency": "monthly"
}
```

---

## HMRC MTD Integration

OAuth 2.0 integration with HMRC Making Tax Digital APIs.

### Authorization Flow

1. **Generate Authorization URL**
```typescript
const url = oauthClient.getAuthorizationUrl(state);
// Redirect user to HMRC for consent
```

2. **Exchange Code for Tokens**
```typescript
const tokenSet = await oauthClient.exchangeCode(code);
// Store tokens securely
```

3. **Submit VAT Return**
```typescript
const result = await vatSubmissionService.submitReturn(
  entityId,
  vrn,
  vatReturn
);
```

### Fraud Prevention Headers

Required for production HMRC API calls:
- `Gov-Client-Connection-Method`
- `Gov-Client-Public-IP`
- `Gov-Client-Device-ID`
- `Gov-Vendor-Version`

---

## Events

### Published Events

| Event | Description |
|-------|-------------|
| `tax.registration.created` | New tax registration created |
| `tax.registration.vat_registered` | Entity registered for VAT |
| `tax.registration.paye_registered` | Entity registered for PAYE |
| `tax.corporation_tax.calculated` | CT calculation performed |
| `tax.corporation_tax.filed` | CT return filed |
| `tax.vat_return.submitted` | VAT return submitted to HMRC |
| `tax.paye.fps_submitted` | FPS submitted to HMRC |
| `tax.employee.p45_issued` | P45 issued for leaver |

### Subscribed Events

| Event | Handler |
|-------|---------|
| `entity-governance.entity.created` | Auto-create tax registration |
| `entity-governance.entity.dissolved` | Deregister from tax schemes |
| `accounting.financial_period.closed` | Update VAT monitoring |

---

## Database Schema

```
uk_tax_registrations     - Entity HMRC registration details
corporation_tax_periods  - CT accounting periods
uk_vat_returns           - VAT return records (MTD format)
paye_submissions         - FPS/EPS RTI submissions
employee_tax_records     - Employee tax data and YTD figures
tax_calculations         - Calculation audit trail
tax_audit_log            - Tax change audit log
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/tax

# Server
PORT=3000
NODE_ENV=development

# HMRC OAuth (Sandbox/Production)
HMRC_CLIENT_ID=your_client_id
HMRC_CLIENT_SECRET=your_client_secret
HMRC_REDIRECT_URI=https://your-app.com/callback
HMRC_ENVIRONMENT=sandbox  # or 'production'

# Messaging
RABBITMQ_URL=amqp://localhost:5672
```

---

## Testing

```bash
# Run all tests
pnpm test

# Run unit tests only (115 tests)
pnpm test tests/unit

# Run specific test file
pnpm test tests/unit/domain/paye.test.ts

# Watch mode
pnpm test:watch
```

---

## Deployment

See `terraform/` directory for AWS infrastructure:
- ECS Fargate for API
- RDS PostgreSQL 16
- ElastiCache Redis
- SQS queues for async processing
- WAF with rate limiting
- CloudWatch monitoring

---

## Dependencies

- **entity-governance**: Entity structure and legal information
- **accounting**: Financial data for tax calculations
- **banking-treasury**: Tax payment processing

---

*Last updated: 2026-01-30*
