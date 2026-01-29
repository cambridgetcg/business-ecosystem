# PCT International Patent Filing System

## Research Question
How does the PCT (Patent Cooperation Treaty) workflow function? What happens between provisional filing and national phase entry?

## Current Model Gap
The current `Patent` entity has:
- `jurisdictions: string[]` - but no concept of PCT vs national filings
- No tracking of international application numbers
- No understanding of the PCT timeline phases
- No handling of "chapter I" vs "chapter II" examination

---

## Key Findings

### What is PCT?
The **Patent Cooperation Treaty** is an international treaty with 155+ contracting states that allows seeking patent protection in multiple countries through a **single international application** rather than filing separate national applications.

**Important**: PCT does NOT grant patents. It delays and centralizes the filing process. Patents are ultimately granted by **national or regional offices**.

### The PCT Timeline

```
Month 0          Month 12         Month 18         Month 30/31
   |                |                |                 |
   v                v                v                 v
Priority        PCT Filing      Publication      National Phase
  Date          Deadline                           Entry Deadline
   |                |                |                 |
[First App]  [Int'l App Filed]  [Published]    [Enter Countries]
                   |                                   |
              "International Phase" ------------------|
```

### Key Milestones

#### Month 0 - Priority Date
- Filing date of the **first application** (usually provisional or national)
- All subsequent deadlines measured from this date
- Can be any national filing (US provisional, US non-provisional, foreign app)

#### Month 12 - PCT Filing Deadline
- Must file PCT international application within 12 months of priority date
- Claims priority under PCT Article 8 and Paris Convention Article 4
- Filed with a **Receiving Office** (e.g., USPTO, EPO, WIPO International Bureau)

#### Month 18 - International Publication
- Application published by WIPO (Thursdays)
- Creates prior art date for third parties
- Published regardless of examination status

#### Month 22 (optional) - Chapter II Demand
- Can request **International Preliminary Examination** (IPEA)
- Gets written opinion on patentability
- Historically required to get 30-month deadline (now automatic)

#### Month 30/31 - National Phase Entry
- Must enter **each desired country/region** individually
- Pay national fees, provide translations
- Start national prosecution process
- **This is when real costs begin**

### Country-Specific Deadlines

| Jurisdiction | Deadline from Priority |
|--------------|----------------------|
| Most countries | 30 months |
| EPO (Euro-PCT) | 31 months |
| United States | 30 months |
| Canada | 30 months |
| Some countries | Still 20 months (rare) |

### PCT Numbers vs National Numbers

A single invention might have:
1. **US Provisional**: 63/xxx,xxx (priority application)
2. **PCT Application**: PCT/US20xx/xxxxxx (international)
3. **US National**: 17/xxx,xxx (national phase)
4. **EP Application**: EP20xxxxxx.x (regional phase)
5. **JP Application**: 20xx-xxxxxx (national phase)

All sharing the same priority date but different numbers!

### Strategic Value of PCT

1. **Delays costs**: 18-30 months to decide which countries matter
2. **Market testing**: Time to assess commercial viability
3. **Single search/examination**: International Search Report (ISR) informs strategy
4. **Centralized filing**: One application, one format, one language initially

---

## Domain Model Implications

### Missing Concepts
1. **Application type**: provisional | national | pct_international | pct_national_phase
2. **PCT application number** (separate from national application number)
3. **Priority claims** - links to earlier applications
4. **PCT phases**: international_phase | national_phase
5. **Designated states** - which countries selected in PCT
6. **National phase entries** - child applications from PCT

### Suggested Schema Additions
```typescript
interface PatentProps {
  // ... existing
  applicationType: 'provisional' | 'non_provisional' | 'pct' | 'national_phase';
  
  // PCT specific
  pctApplicationNumber?: string;      // PCT/US2024/012345
  pctFilingDate?: Date;
  pctPublicationDate?: Date;
  internationalSearchReportDate?: Date;
  designatedStates?: string[];        // ['US', 'EP', 'JP', 'CN']
  
  // Priority chain
  priorityClaims?: PriorityClaim[];
}

interface PriorityClaim {
  applicationNumber: string;
  filingDate: Date;
  country: string;
  isPctClaim: boolean;
}

// For tracking national phase entries
interface NationalPhaseEntry {
  pctParentId: string;              // The PCT application
  nationalPatentId: string;         // The national application
  country: string;
  entryDate: Date;
  nationalApplicationNumber: string;
}
```

### Status Considerations
Current statuses don't capture PCT lifecycle:
- Need: 'pct_international' | 'pct_published' | 'entered_national_phase'
- Or separate PCT status tracking

---

## Sources
- [WIPO PCT FAQs](https://www.wipo.int/pct/en/faqs/faqs.html)
- [USPTO MPEP 1842 - Basic Flow Under PCT](https://www.uspto.gov/web/offices/pac/mpep/s1842.html)
- [WIPO PCT Time Limits](https://www.wipo.int/en/web/pct-system/texts/time_limits)
- [PCT Timeline - IP Coster](https://ip-coster.com/academy/details/pct_time_limits)
- [International PCT Applications Basics - Mewburn Ellis](https://www.mewburn.com/law-practice-library/international-pct-patent-applications-the-basics)
- [Patent Cooperation Treaty - Wikipedia](https://en.wikipedia.org/wiki/Patent_Cooperation_Treaty)

---

## Research Date
2026-01-26
