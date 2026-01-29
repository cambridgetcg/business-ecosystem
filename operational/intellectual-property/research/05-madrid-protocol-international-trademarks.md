# Madrid Protocol for International Trademarks

## Research Question
How does the Madrid Protocol work for international trademark registration? What is "central attack" and the 5-year dependency period?

## Current Model Gap
The current `Trademark` entity has:
- `jurisdictions: string[]` - but no concept of Madrid vs direct national filings
- No understanding of international registration numbers
- No tracking of "basic mark" relationships
- No concept of the 5-year dependency vulnerability

---

## Key Findings

### What is the Madrid System?

The **Madrid System** (governed by the Madrid Protocol) is an international trademark registration system administered by WIPO that allows:
- Filing ONE application
- In ONE language
- Paying ONE set of fees
- To protect a mark in **multiple countries** (130+ members)

**Important**: Like PCT for patents, Madrid doesn't create a single "world trademark." It creates a **bundle of national protections** administered centrally.

### How It Works

```
Home Country            WIPO              Designated Countries
    |                    |                        |
    v                    v                        v
Basic Mark -------> International -------> National Protections
(required)         Registration (IR)       in each country
    |                    |                        |
    |--- 5 YEAR DEPENDENCY ---|                   |
```

### The Dependency Principle (Article 6)

For the **first 5 years** from the International Registration date:
- The IR is **dependent** on the "basic mark" (home country app/registration)
- If basic mark dies → IR dies (in all countries!)
- After 5 years → IR becomes **independent** of basic mark

### Central Attack

**Central Attack** = A third party attacking the **basic mark** (in home country) to kill the **entire international registration**.

| Without Central Attack | With Central Attack |
|----------------------|---------------------|
| Must challenge in each country separately | Challenge once, kill everywhere |
| Expensive for attacker | Cost-effective for attacker |
| Trademark owner has multiple defenses | Single point of failure |

**Example**: 
- Company files US trademark (basic mark)
- Uses Madrid to extend to EU, Japan, China
- Competitor challenges US mark within 5 years
- If US mark is cancelled → ALL Madrid designations cancelled

### Frequency of Central Attacks

Despite fears, central attacks are **rare**:
- WIPO data shows very few successful central attacks
- Most occur in EU
- But the **risk** still deters some users from Madrid

**Survey results (2015)**:
- 35% of users see dependency as disadvantage
- 62% want it abolished or reduced
- 34% would use Madrid more without dependency
- INTA advocates reducing to 3 years

### The Transformation Option

If central attack succeeds, you can **"transform"** the dead IR designations into **direct national applications** in each country:
- Preserves original priority date
- But loses all cost savings
- Must handle each country separately going forward
- Essentially starts over with direct filings

### Madrid Registration Numbers

A Madrid-protected mark has:
1. **Basic mark number**: Home country (e.g., US Reg. No. 1,234,567)
2. **International Registration number**: WIPO (e.g., IR 1234567)
3. **National extension numbers**: Per country (each country's internal number)

### Timeline

```
Year 0              Year 5              Year 10
  |                   |                    |
  v                   v                    v
Basic Mark Filed   Dependency Ends    Renewal Due
IR Filed          IR Independent       (every 10 years)
  |                   |                    |
  |----VULNERABLE-----|----INDEPENDENT----|
```

### Advantages of Madrid
1. **Cost-effective**: One filing, one language
2. **Centralized management**: Renewals, changes via WIPO
3. **Fast**: 12-18 months for examination vs years direct
4. **Portfolio visibility**: All designations in one record

### Disadvantages of Madrid
1. **Central attack risk** during 5-year dependency
2. **Basic mark required**: Must have home country filing first
3. **Scope limitations**: Can't be broader than basic mark
4. **Not all countries**: Some major markets not members

---

## Domain Model Implications

### Missing Concepts
1. **Registration type**: national | madrid_ir | madrid_extension
2. **Basic mark relationship**: Link IR to home country mark
3. **Dependency status**: tracking the 5-year period
4. **WIPO IR number**: separate from national numbers
5. **Designated countries**: which countries in IR
6. **Transformation**: tracking if converted from IR

### Suggested Schema Additions
```typescript
interface TrademarkProps {
  // ... existing
  registrationType: 'national' | 'madrid_international' | 'madrid_extension';
  
  // Madrid-specific
  internationalRegistrationNumber?: string;  // IR 1234567
  internationalRegistrationDate?: Date;
  
  // If this is a Madrid IR
  basicMarkId?: string;                // Link to home country trademark
  designatedCountries?: string[];      // Countries in this IR
  dependencyEndDate?: Date;            // 5 years from IR date
  isIndependent: boolean;              // True after 5 years
  
  // If this came from transformation
  transformedFromIR?: string;          // Original IR number
  transformationDate?: Date;
}

interface MadridDesignation {
  internationalRegistrationId: string;
  country: string;
  designationDate: Date;
  status: 'pending' | 'protected' | 'refused' | 'cancelled';
  refusalReason?: string;
  protectionGrantedDate?: Date;
  
  // If transformed to national
  transformedToNational: boolean;
  nationalTrademarkId?: string;
}

// Events for central attack tracking
interface CentralAttackProceeding {
  basicMarkId: string;
  internationalRegistrationId: string;
  proceedingType: 'opposition' | 'cancellation' | 'invalidation';
  filedDate: Date;
  status: 'pending' | 'decided_against_owner' | 'decided_for_owner' | 'settled';
  decisionDate?: Date;
  affectedDesignations: string[];
}
```

---

## Sources
- [WIPO Madrid System Overview](https://www.wipo.int/en/web/madrid-system)
- [Madrid Protocol - Wikipedia](https://en.wikipedia.org/wiki/Madrid_Protocol)
- [Central Attack Analysis - Berkeley Tech Law Journal](https://btlj.org/2019/04/madrids-central-attack-in-transnational-trademark-law-practice-procedures-and-strategic-considerations/)
- [Madrid System Limitations - Harris Sliwoski](https://harris-sliwoski.com/chinalawblog/the-madrid-system-for-trademarks-powerful-but-not-always-the-right-tool/)
- [INTA Board Resolution on Dependency Period](https://www.inta.org/wp-content/uploads/public-files/advocacy/board-resolutions/Madrid-Protocol-Dependency-Period-03.20.2017.pdf)
- [WIPO Working Group Documents 2024](https://www.wipo.int/edocs/mdocs/madrid/en/mm_ld_wg_22/mm_ld_wg_22_5.pdf)

---

## Research Date
2026-01-26
