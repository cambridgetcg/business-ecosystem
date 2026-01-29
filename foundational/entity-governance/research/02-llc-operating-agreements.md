# LLC Operating Agreements vs Corporate Bylaws

## Knowledge Gap Identified

The current model assumes corporate governance patterns (boards, directors, shares) while LLCs operate on contractual partnership patterns (operating agreements, members, capital accounts). Our `bylaws` table doesn't fit LLC structures.

## Key Findings

### Fundamental Structural Differences

| Aspect | Corporation | LLC |
|--------|-------------|-----|
| **Governing Document** | Bylaws + Certificate of Incorporation | Operating Agreement (single document) |
| **Formation Filing** | Articles of Incorporation | Certificate/Articles of Organization |
| **Ownership Units** | Shares (divided into classes) | Membership Interests (percentage or units) |
| **Owners** | Shareholders | Members |
| **Management** | Board of Directors + Officers | Member-managed OR Manager-managed |
| **Profit Distribution** | Dividends (generally pro-rata) | Distributions (flexible allocation) |
| **Ownership Tracking** | Stock ledger, share certificates | Capital accounts |
| **Tax Default** | C-Corporation | Partnership (multi) or Disregarded (single) |
| **Flexibility** | Statutory framework with limited variation | Maximum contractual freedom |

### Management Structures

**Member-Managed LLC**:
- All members participate in management decisions
- Any member can bind the LLC to contracts
- Voting typically by ownership percentage
- Similar to general partnership

**Manager-Managed LLC**:
- Members elect or appoint manager(s)
- Only managers can bind the LLC
- Members have limited day-to-day role
- Similar to limited partnership or corporation

### Capital Accounts (Critical LLC Concept)

Unlike corporations where shareholders simply own shares, LLC members have **capital accounts** that track their economic stake:

| Transaction | Effect on Capital Account |
|-------------|--------------------------|
| Initial contribution | + Amount contributed |
| Allocated profit | + Member's share of profit |
| Allocated loss | - Member's share of loss |
| Distribution | - Amount distributed |

**Critical Distinctions**:
- **Capital Account** (Book Basis): Tracked on LLC's books per operating agreement
- **Tax Basis**: Each member's IRS basis for calculating gain/loss (different calculation)
- **Ownership Percentage**: May be completely unrelated to capital account balance

### Special Allocations

Unlike corporations (dividends pro-rata by shares), LLCs can make **special allocations**:

| Scenario | Allocation Pattern |
|----------|-------------------|
| Tax losses to high-bracket member | 100% depreciation to Member A |
| Preferred return | First $100K to Member A, then split 50/30/20 |
| Targeted tax items | Capital gains per capital; ordinary income per ownership |

These allocations must satisfy IRS "substantial economic effect" rules (IRC 704(b)).

### LLC Distribution Waterfalls

Typical structure:
1. **Tier 1**: Return of Capital - Until capital accounts at target
2. **Tier 2**: Preferred Return (8% IRR) - To preferred members
3. **Tier 3**: Catch-Up - To manager/sponsor
4. **Tier 4**: Residual Split (80/20) - Pro-rata remainder

### LLC Tax Classification (Check-the-Box)

| LLC Structure | Default Tax Treatment | Can Elect |
|---------------|----------------------|-----------|
| Single-Member LLC | Disregarded Entity | C-Corp, S-Corp |
| Multi-Member LLC | Partnership (Form 1065) | C-Corp, S-Corp |

S-Corp election requires Form 2553 in addition to Form 8832.

### Series LLCs

A **Series LLC** is a single legal entity with multiple internal "series" where each series:
- Has its own members, managers, and assets
- Maintains separate liability from other series
- Can have its own operating agreement provisions

**States Allowing Series LLCs**: Delaware, Texas, Illinois, Nevada, Oklahoma, Iowa, Tennessee, Utah, Montana, Alabama, Kansas, Missouri, Indiana, Puerto Rico.

### Operating Agreement Structure

Key articles typically include:
- **Formation**: Name, office, registered agent, purpose, term
- **Definitions**: Capital account, membership interest, units
- **Members**: Admission, withdrawal, transfer restrictions
- **Capital Contributions**: Initial, additional, form (cash/property/services)
- **Allocations**: Profit/loss, special allocations, tax allocations
- **Distributions**: Timing, waterfall, tax distributions
- **Management**: Member-managed vs manager-managed, voting
- **Books and Records**: Required records, inspection rights
- **Transfer of Interests**: ROFR, tag-along, drag-along, buy-sell
- **Dissolution**: Events, winding up, asset distribution

## Model Implications

### Current Schema Gaps

| Current Schema | LLC Requirement | Gap |
|----------------|-----------------|-----|
| bylaws table | Operating agreements | Need operating_agreements with management type |
| shareholders table | Members | Need members with admission/withdrawal tracking |
| share_classes table | Membership interests | Need classes with allocation methods |
| shareholdings table | Membership holdings | Need percentage OR units, separate voting % |
| No equivalent | Capital accounts | Need full capital account tracking per member |
| No equivalent | Distributions | Need distribution tracking with waterfall tiers |
| No equivalent | Tax elections | Need to track check-the-box elections |
| No equivalent | Managers | Need manager tracking for manager-managed LLCs |
| No equivalent | Series | Need series support for Series LLCs |

### Recommended Schema Extensions

New tables needed:
- `operating_agreements` - with management_type, allocation/distribution/voting provisions
- `members` - LLC equivalent of shareholders
- `capital_accounts` - track contributions, allocations, distributions
- `llc_tax_elections` - track check-the-box elections
- `llc_series` - for Series LLC support
- `managers` - for manager-managed LLCs

## Why This Matters

1. **Data model accuracy** - Can't represent LLCs with corporate tables
2. **Tax integration** - K-1 generation requires capital account tracking
3. **Allocation calculations** - Complex profit/loss allocation rules
4. **Compliance** - Different formality requirements than corporations
5. **User experience** - System should guide based on entity type

## Questions for Further Research

1. How do we handle hybrid entities (LLC taxed as S-Corp)?
2. Should waterfall calculations be in entity-governance or finance service?
3. How do we model scenario analysis for distribution projections?
4. What reporting/visualization does capital account tracking need?
