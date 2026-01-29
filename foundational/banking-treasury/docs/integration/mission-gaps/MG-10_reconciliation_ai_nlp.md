# MG-10: Reconciliation AI/NLP for Edge Cases

## Gap Classification

| Attribute | Value |
|-----------|-------|
| **Gap ID** | MG-10 |
| **Domain** | Reconciliation |
| **Mission Capability** | M6: Automated Reconciliation |
| **Understanding Level** | KNOWS |
| **Priority** | IMPORTANT |

---

## The Gap

We understand that **5-15% of transactions** require manual handling (research 15). We do **not** understand **how to apply AI/NLP** to push automation from 85% to the 95%+ target.

---

## What We Know

From PURPOSE.md success metrics:
- **Reconciliation automation**: >95% of transactions auto-matched without manual intervention

From research 15 (Reconciliation Edge Cases):
- 85-95% STP achievable with rule-based matching
- Remaining 5-15% consumes 80% of operational effort
- Edge cases include: vague references, partial matches, FX variances, timing differences

From research 15 (specific edge cases):
- Truncated references: "INV-2025..." (cutoff)
- Customer errors: Wrong invoice number
- Batch references: "Multiple items"
- No reference: Just amount and date

---

## What We Don't Know

### 1. NLP for Reference Parsing

**Unknown**: How do we extract structured information from unstructured payment references?

| Reference Type | Example | Extraction Challenge |
|----------------|---------|---------------------|
| Truncated | "INV-2025..." | Pattern completion |
| Misspelled | "ACME CORP" vs "Acme Corporation" | Fuzzy entity matching |
| Abbreviated | "PO#12345 Q3" | Abbreviation expansion |
| Multi-reference | "Invoices 1001, 1002, 1003" | List extraction |
| Free text | "Payment for consulting services" | Intent extraction |

**Questions**:
- What NLP techniques work for payment references?
- Do we need domain-specific training?
- What accuracy is achievable?

### 2. Fuzzy Matching Algorithms

**Unknown**: What fuzzy matching approaches work best for reconciliation?

| Algorithm | Use Case | Unknown |
|-----------|----------|---------|
| **Levenshtein distance** | Typo correction | Threshold tuning |
| **Soundex/Metaphone** | Phonetic matching | Applicability to business names |
| **TF-IDF + cosine** | Reference similarity | Feature engineering |
| **Embedding similarity** | Semantic matching | Model selection |
| **Entity resolution** | Counterparty matching | Training data |

**Questions**:
- What combination of algorithms achieves best results?
- How do we tune thresholds to minimize false positives?
- How do we handle multi-language references?

### 3. Learning from Human Decisions

**Unknown**: How do we capture and learn from manual reconciliation decisions?

```
Human Decision:
  Bank: "$10,000 from ACME CORP"
  Matched to: Invoice #1001 from Acme Corporation

Learning Questions:
  - How do we capture this mapping?
  - How do we generalize to future transactions?
  - How do we avoid overfitting to specific cases?
```

### 4. Confidence Scoring

**Unknown**: How do we score confidence in AI-suggested matches?

| Confidence Level | Action | Unknown |
|------------------|--------|---------|
| HIGH (>95%) | Auto-match | Threshold calibration |
| MEDIUM (70-95%) | Suggest + review | Review UX |
| LOW (<70%) | Manual | When to give up |

**Questions**:
- How do we calibrate confidence thresholds?
- What's the right UX for suggested matches?
- How do we handle multiple candidate matches?

### 5. Achieving 95%+ Target

**Unknown**: What's the gap from 85% to 95%?

| Current STP | Target | Gap | Unknown |
|-------------|--------|-----|---------|
| 85% | 95% | 10% | What's in the 10%? |

**Questions**:
- What's the distribution of edge case types?
- Which edge cases are AI-solvable vs. truly ambiguous?
- What's the realistic ceiling for automation?

---

## Impact on Mission

### M6: Automated Reconciliation

**SUCCESS METRIC** (PURPOSE.md):
- Reconciliation automation: >95% of transactions auto-matched

**BLOCKED BY THIS GAP**: Cannot achieve 95%+ without AI augmentation for edge cases

### Implementation Plan Impact

**Phase 2 (Weeks 11-16)**: Reconciliation Engine

```typescript
// From IMPLEMENTATION_PLAN.md
interface ReconciliationEngine {
  importStatement(statement: BankStatement): Promise<ImportResult>;
  runMatching(accountId: string, statementId: string): Promise<MatchingResult>;
  getExceptions(accountId: string): Promise<ReconciliationException[]>;
  resolveException(exceptionId: string, resolution: ExceptionResolution): Promise<void>;
}
```

The `runMatching` function needs AI augmentation to achieve 95%+.

---

## Research Required

### Primary Questions

1. **Reference NLP**: What NLP techniques extract structure from payment references?
2. **Fuzzy matching**: What algorithm combination works best for reconciliation?
3. **Learning from humans**: How do we capture and generalize manual decisions?
4. **Confidence scoring**: How do we calibrate match confidence?
5. **95% achievability**: What's the realistic automation ceiling?

### Secondary Questions

1. How do vendor solutions (Ledge AI, Modern Treasury) approach this?
2. What pre-trained models are applicable (BERT, GPT for extraction)?
3. How do we handle edge cases in multiple languages?
4. What feedback loop improves the system over time?
5. How do we explain AI decisions for audit purposes?

---

## Architectural Options to Investigate

### Option A: Rule-Based + Fuzzy

```
Bank Transaction
       │
       ▼
┌──────────────────┐
│ Rule-Based Match │ ──► MATCH (85%)
└──────────────────┘
       │ NO MATCH
       ▼
┌──────────────────┐
│ Fuzzy Matching   │ ──► CANDIDATE (10%)
│ (Levenshtein,    │
│  TF-IDF)         │
└──────────────────┘
       │ NO CANDIDATE
       ▼
    MANUAL (5%)
```

**Pros**: Interpretable, predictable
**Cons**: May not reach 95%

### Option B: ML Classification

```
Bank Transaction + Features
           │
           ▼
┌────────────────────────┐
│ Feature Extraction     │
│ - Reference embedding  │
│ - Amount similarity    │
│ - Date proximity       │
│ - Counterparty score   │
└────────────────────────┘
           │
           ▼
┌────────────────────────┐
│ ML Classifier          │
│ (Random Forest, XGB)   │
└────────────────────────┘
           │
           ▼
   Match + Confidence
```

**Pros**: Can learn complex patterns
**Cons**: Needs training data

### Option C: LLM-Assisted

```
Bank Transaction + Context
           │
           ▼
┌────────────────────────┐
│ LLM Extraction         │
│ "Extract invoice #,    │
│  counterparty, amount" │
└────────────────────────┘
           │
           ▼
┌────────────────────────┐
│ Structured Search      │
│ Against open items     │
└────────────────────────┘
           │
           ▼
   Match + Confidence
```

**Pros**: Handles unstructured text well
**Cons**: Latency, cost, reliability

### Option D: Hybrid Pipeline

```
                      ┌─► Rule Match ──────► AUTO (85%)
                      │
Bank Transaction ─────┼─► ML Classifier ───► CONFIDENT (7%)
                      │
                      └─► LLM Fallback ────► SUGGESTED (3%)
                                                  │
                                                  ▼
                                            MANUAL (5%)
```

**Pros**: Best of all approaches
**Cons**: Complex, harder to maintain

---

## Connection to Existing Work

| Document | Relevance |
|----------|-----------|
| research/15_RECONCILIATION_EDGE_CASES.md | Documents the problem |
| No existing question or prompt | **NEW GAP** |

---

## Resolution Criteria

This gap is **RESOLVED** when:

- [ ] NLP approach for reference extraction selected
- [ ] Fuzzy matching algorithm combination defined
- [ ] Learning feedback loop designed
- [ ] Confidence scoring calibrated
- [ ] 95%+ achievability validated or ceiling documented
- [ ] Implementation architecture decided

---

## Resolution Status: ✓ RESOLVED

**Research findings documented in**: `research-findings/RF-02_reconciliation_nlp.md`

**Key decisions**:
- NLP: Regex + spaCy + Sentence-BERT pipeline
- Fuzzy matching: Levenshtein + Jaro-Winkler
- Target: 95%+ achievable (industry benchmarks confirm)
- Confidence: 4-tier scoring framework

---

*Gap Identified: January 2026*
*Gap Resolved: January 2026*
*Blocks: Phase 2 success metrics*
