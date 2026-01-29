# Trademark Use Requirements and Abandonment

## Research Question
What constitutes "use in commerce"? When does non-use result in abandonment? What are the Section 8/9 declaration requirements?

## Current Model Gap
The current `Trademark` entity has:
- `status: 'abandoned'` - but no concept of WHY (non-use vs intentional)
- `renewalDate` - but no tracking of Section 8 declarations
- No understanding of "use in commerce" concept
- No tracking of goods/services actually in use

---

## Key Findings

### "Use in Commerce" Definition

Under US trademark law, "use in commerce" means:
- Commerce that **Congress can lawfully regulate**
- Must be **bona fide use** in the ordinary course of trade (not token use)
- Using mark **solely in a foreign country** does NOT count
- Must be in connection with the sale/transport of goods OR rendering of services

**The key insight**: Registration alone is not enough. You must **continuously USE** the mark or lose it.

### Abandonment Through Non-Use

| Situation | Result |
|-----------|--------|
| Ceased use for **<3 years** | May claim "excusable non-use" |
| Ceased use for **≥3 years** | Creates **presumption of abandonment** |
| Non-use + no intent to resume | **Abandonment** (loss of rights) |

**3-year rule**: If mark not used for 3 consecutive years with no intent to resume, USPTO **presumes abandonment**. The burden shifts to the owner to prove otherwise.

### Section 8 Declaration of Use

The Section 8 is a **mandatory filing** to maintain a trademark registration. You must affirm you're still using the mark in commerce.

#### Filing Windows

```
Registration                 Year 5        Year 6        Year 9       Year 10
     |                          |             |             |             |
     |                          |--- Sec 8 ---|             |-- Sec 8+9 --|
     |                          |   Window    |             |   Window    |
     v                          v             v             v             v
  Registered              Window Opens    Deadline    Window Opens    Deadline
                          (no grace)     (+6mo grace)  (no grace)    (+6mo grace)
```

#### Timeline Summary
| Filing | Window | What to File |
|--------|--------|--------------|
| Year 5-6 | Between 5th & 6th anniversary | Section 8 only (Declaration of Use) |
| Year 9-10 | Between 9th & 10th anniversary | Section 8 + Section 9 (Use + Renewal) |
| Every 10 years after | Years 19-20, 29-30, etc. | Section 8 + Section 9 |

#### Grace Period
- 6-month grace period **after** the filing window closes
- Requires **additional fee** (surcharge)
- If still missed → **Registration CANCELLED**

### Excusable Non-Use

If you're not currently using the mark, you may claim **excusable non-use** if:
1. Circumstances are **beyond your control**
2. You have **intent to resume use**
3. Non-use has been for **less than 3 years** generally

**Examples of excusable non-use**:
- Fire/natural disaster affecting production
- Pending government approval (FDA, etc.)
- Litigation preventing use
- Pandemic-related disruptions

**NOT excusable**:
- Just didn't feel like using it
- Foreign use only (US use required)
- Licensing issues within your control

### What Must Be Proved in Section 8

1. Mark is **still in use** in commerce, OR
2. Non-use is **excusable** with intent to resume
3. **Specimen** showing current use (photo, screenshot, packaging)
4. Identification of which goods/services the mark is used on
   - Can delete goods/services no longer using from registration

### Partial Use / Partial Abandonment

Important nuance: If a trademark registration covers multiple classes/goods, you must show use **in each class** for which you want to maintain rights.

- Can **delete** classes you're no longer using
- Cannot add new goods/services (need new application)
- Failure to show use for a class = lose that class

---

## Domain Model Implications

### Missing Concepts
1. **Use tracking per class/goods**: Which goods/services are actually in use
2. **Section 8 filings**: Deadlines, submissions, acceptances
3. **Specimens**: Evidence of use attached to declarations
4. **Excusable non-use periods**: Tracking temporary non-use
5. **Abandonment type**: voluntary | non_use | failure_to_file

### Suggested Schema Additions
```typescript
interface TrademarkProps {
  // ... existing
  
  // Track use per class
  useStatus: NiceClassUseStatus[];
}

interface NiceClassUseStatus {
  classNumber: number;
  inUse: boolean;
  lastUseDate?: Date;
  excusableNonUseReason?: string;
  excusableNonUseStart?: Date;
}

interface Section8Filing {
  trademarkId: string;
  filingType: 'section_8' | 'section_8_9';
  dueWindowStart: Date;        // Year 5, 9, 19, 29...
  dueWindowEnd: Date;          // Year 6, 10, 20, 30...
  gracePeriodEnd: Date;        // +6 months from window end
  
  status: 'upcoming' | 'due' | 'grace_period' | 'filed' | 'accepted' | 'refused' | 'missed';
  filedDate?: Date;
  acceptedDate?: Date;
  
  // What was declared
  classesInUse: number[];
  classesDeleted: number[];     // No longer using
  excusableNonUseClaimed: boolean;
  excusableNonUseReason?: string;
  
  // Evidence
  specimenIds: string[];
}

// Refine status
type TrademarkStatus = 
  | 'draft' | 'pending' | 'published' | 'opposed' 
  | 'registered' 
  | 'cancelled_non_use'         // Failed Section 8
  | 'cancelled_voluntary'       // Owner chose to cancel
  | 'abandoned_non_use'         // 3+ years non-use
  | 'abandoned_voluntary'       // Owner abandoned
  | 'expired';                  // Failed Section 9 renewal
```

---

## Sources
- [USPTO - Keeping Your Registration Alive](https://www.uspto.gov/trademarks/maintain/keeping-your-registration-alive)
- [USPTO - Section 8 Declaration Form](https://www.uspto.gov/sites/default/files/SEC8.pdf)
- [USPTO - Maintenance Definitions](https://www.uspto.gov/trademarks/maintain/forms-file/definitions-maintaining-trademark)
- [Section 8 Declaration Explained - Nolo](https://www.nolo.com/legal-encyclopedia/how-when-do-you-file-section-8-declaration.html)
- [Section 8 & 9 Overview - Wilson Legal](https://www.wilsonlegalgroup.com/blogs/trademark-law/trademark-renewal-and-maintenance)
- [Can You Lose Trademark Rights? - Ivetic Law](https://www.iveticlaw.com/after-you-obtain-a-federal-trademark-registration-can-you-lose-your-rights)

---

## Research Date
2026-01-26
