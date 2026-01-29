# Patent Maintenance Fees and Lapse Triggers

## Research Question
When and how do patents "lapse" vs "expire"? What are the maintenance fee schedules and grace periods?

## Current Model Gap
The current `Patent` entity has:
- `status: 'lapsed' | 'expired'` - but no distinction between natural expiration and lapse due to non-payment
- `expirationDate` - but no maintenance fee tracking
- No concept of entity size (large/small/micro) affecting fees
- No tracking of which maintenance fees have been paid

---

## Key Findings

### Expiration vs Lapse

| Term | Meaning |
|------|---------|
| **Expired** | Patent reached end of its natural term (20 years from filing) |
| **Lapsed** | Patent died early due to **failure to pay maintenance fees** |

Both result in loss of patent rights and dedication to public domain, but they're different events!

### Who Pays Maintenance Fees?
- **Utility patents**: YES - must pay at 3.5, 7.5, and 11.5 years
- **Design patents**: NO - no maintenance fees required
- **Plant patents**: NO - no maintenance fees required

### Maintenance Fee Schedule (2025)

| Time After Grant | Large Entity | Small Entity | Micro Entity |
|------------------|--------------|--------------|--------------|
| 3.5 years | $2,150 | $860 | $430 |
| 7.5 years | $4,040 | $1,616 | $808 |
| 11.5 years | $8,280 | $3,312 | $1,656 |

**Note**: Small entities pay 50% of large entity fees; micro entities pay 25%.

### Payment Windows

```
Year 3                    Year 3.5                   Year 4
  |                          |                          |
  |--- Window Opens -------->|<---- Grace Period ------>|
  |    (no surcharge)        |      (with surcharge)    |
  |                          |                          |
  v                          v                          v
Can start paying        Due Date                   Patent Lapses
                                                   if not paid
```

#### Window Without Surcharge
- **3.0 - 3.5 years**: First maintenance fee
- **7.0 - 7.5 years**: Second maintenance fee
- **11.0 - 11.5 years**: Third maintenance fee

You **cannot** pay earlier than the window opening!

#### Grace Period (With Surcharge)
If you miss the due date, you have 6 more months with a **surcharge**:
- **Large**: $540 surcharge
- **Small**: $216 surcharge
- **Micro**: $108 surcharge

### What Happens When Fees Are Missed

1. **Due date passes** → Enters grace period (surcharge applies)
2. **Grace period ends** → Patent **lapses immediately**
3. **After lapse** → Patent rights lost, invention enters public domain
4. **Possible reinstatement** → Must petition USPTO, prove delay was "unintentional"

### Reinstatement After Lapse
- Not automatic or guaranteed
- Requires petition + fees
- Must demonstrate "unintentional" delay
- Gets more difficult/expensive over time
- Creates period of uncertainty about patent validity

### Critical Dates for a Patent Granted January 15, 2024

| Event | Date | Notes |
|-------|------|-------|
| Grant Date | Jan 15, 2024 | Start counting |
| Window 1 Opens | Jan 15, 2027 | Can pay 1st fee |
| 1st Fee Due | Jul 15, 2027 | 3.5 years |
| Grace Ends | Jan 15, 2028 | Lapses if unpaid |
| Window 2 Opens | Jan 15, 2031 | Can pay 2nd fee |
| 2nd Fee Due | Jul 15, 2031 | 7.5 years |
| Grace Ends | Jan 15, 2032 | Lapses if unpaid |
| Window 3 Opens | Jan 15, 2035 | Can pay 3rd fee |
| 3rd Fee Due | Jul 15, 2035 | 11.5 years |
| Grace Ends | Jan 15, 2036 | Lapses if unpaid |
| Natural Expiration | ~Jan 15, 2044 | 20 years from filing* |

*Expiration is from filing date, not grant date

---

## Domain Model Implications

### Missing Concepts
1. **Entity size**: large | small | micro (affects all fees)
2. **Maintenance fee tracking**: which fees paid, when, amount
3. **Payment windows**: when fees become payable
4. **Lapse date**: distinct from expiration date
5. **Reinstatement status**: if patent was revived after lapse

### Suggested Schema Additions
```typescript
interface PatentProps {
  // ... existing
  entitySize: 'large' | 'small' | 'micro';
  
  // Different from expirationDate (natural term end)
  lapseDate?: Date;  // If lapsed due to non-payment
  lapseReason?: 'maintenance_fee_1' | 'maintenance_fee_2' | 'maintenance_fee_3';
  
  // Reinstatement tracking
  wasRevived: boolean;
  revivalDate?: Date;
  revivalPetitionType?: 'unintentional' | 'unavoidable';
}

interface MaintenanceFee {
  patentId: string;
  feeNumber: 1 | 2 | 3;              // Which of the three
  dueDate: Date;                      // 3.5, 7.5, or 11.5 years after grant
  windowOpensDate: Date;              // 3, 7, or 11 years after grant
  gracePeriodEndsDate: Date;          // 4, 8, or 12 years after grant
  
  // Payment tracking
  status: 'upcoming' | 'payable' | 'grace_period' | 'paid' | 'missed';
  paidDate?: Date;
  paidAmount?: number;
  surchargeApplied: boolean;
  entitySizeAtPayment?: 'large' | 'small' | 'micro';
}
```

### Status Refinement
Consider adding:
- `lapsed_maintenance` - distinct from `abandoned` (voluntary)
- `expired_term` - reached natural 20-year term
- `revived` - was lapsed but reinstated

---

## Sources
- [USPTO Fee Schedule 2025](https://www.uspto.gov/sites/default/files/documents/USPTO-fee-schedule_current.pdf)
- [USPTO - Maintain Your Patent](https://www.uspto.gov/patents/maintain)
- [USPTO MPEP 2506 - Maintenance Fee Times](https://www.uspto.gov/web/offices/pac/mpep/s2506.html)
- [Patent Maintenance Fees Guide - Sierra IP Law](https://sierraiplaw.com/patent-maintenance-fees/)
- [Patent Maintenance Fees - TraskBritt](https://www.traskbritt.com/a-guide-to-paying-patent-maintenance-fees/)
- [2025 Fee Increases - Dickinson Wright](https://www.dickinson-wright.com/news-alerts/blog-arndt-uspto-2025-patent-fee-increases)

---

## Research Date
2026-01-26
