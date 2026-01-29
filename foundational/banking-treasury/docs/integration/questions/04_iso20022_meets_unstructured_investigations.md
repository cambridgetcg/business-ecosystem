# Question: When Does ISO 20022 Structured Data Meet Unstructured Investigations?

## The Gap

Research celebrated ISO 20022's structured data enabling machine intelligence. But complex payment investigations often require **unstructured communication**—emails, phone calls, explanations. Where's the boundary?

## The Specific Question

```
For a payment stuck at an intermediary bank:
  → What can be resolved with structured ISO 20022 messages?
  → When must humans intervene with unstructured communication?
  → How do we capture unstructured investigation results in structured format?
  → What's the handoff protocol between automated and human investigation?
```

## Why This Matters

### The Promise vs. Reality

**ISO 20022 Promise:**
```
camt.110 (Notification to Receive) → Know payment is coming
camt.111 (Debit/Credit Notification) → Confirm receipt
camt.027 (Claim Non-Receipt) → Automated investigation
camt.029 (Resolution of Investigation) → Automated resolution
```

**But reality includes:**
- "The beneficiary name doesn't match our records" (needs human clarification)
- "Please provide purpose of payment" (compliance query)
- "Intermediary bank rejected—please resubmit with..." (custom requirements)

### The Automation Ceiling

```
STRUCTURED (Automated)              UNSTRUCTURED (Human)
─────────────────────────────────────────────────────────────►
                    │
                    │
                    ▼
              WHERE IS THIS LINE?

Examples that need humans:
• Name matching disputes
• Compliance investigations
• Relationship-based problem solving
• Multi-party coordination
• Legal/regulatory responses
```

## Current Understanding

| Investigation Type | ISO 20022 Can Handle | Requires Human |
|-------------------|---------------------|----------------|
| **Payment status** | Yes (pain.002, camt messages) | Rarely |
| **Missing payment** | Partially (camt.027) | Often |
| **Wrong amount** | Partially | Sometimes |
| **Compliance hold** | Notify, not resolve | Yes |
| **Beneficiary mismatch** | Notify | Yes |
| **Multi-hop failures** | Track, not resolve | Often |

## The Investigation Workflow Gap

```
Step 1: Automated tracking detects problem
        → ISO 20022 messages work here

Step 2: Automated query to next hop
        → ISO 20022 can request info

Step 3: Response requires interpretation
        → HERE'S THE GAP
        → Response may be structured (great)
        → Response may be unstructured (now what?)

Step 4: Resolution requires action
        → May need human negotiation
        → May need relationship leverage
        → May need creative problem-solving
```

## Hypotheses to Investigate

### Hypothesis 1: Structured Escalation Path
- Define clear criteria for automated → human handoff
- Structured message: "Investigation escalated, reason: [code]"
- Human inherits full structured history
- Human resolution captured in structured fields

### Hypothesis 2: NLP Layer for Unstructured Ingestion
- Receive unstructured responses (emails, faxes)
- NLP extracts key information
- Maps to structured investigation record
- Enables partial automation even with unstructured input

### Hypothesis 3: Hybrid Investigation Record
```typescript
InvestigationRecord {
  // Structured portion (ISO 20022 derived)
  case_id: string
  payment_instruction_id: string
  status_codes: StatusCode[]
  structured_messages: ISO20022Message[]

  // Unstructured portion (human captured)
  notes: Note[]
  attachments: Attachment[]
  correspondence: Correspondence[]

  // Resolution
  resolution_code: string  // Structured
  resolution_narrative: string  // Unstructured
}
```

### Hypothesis 4: Investigation SLA by Complexity
- Simple (automated): 4 hours
- Standard (human assist): 1-2 days
- Complex (relationship required): 3-5 days
- Escalation triggers automatic at SLA breach

## Research Directions

1. **SWIFT gCCT documentation** — How do they handle the structured/unstructured boundary?
2. **Bank investigation workflows** — How do ops teams actually handle exceptions?
3. **Case management vendors** — How do they bridge structured and unstructured?
4. **ISO 20022 implementation guides** — What's expected vs. optional in messages?

## The Architectural Decision

This question affects investigation management:

```
Option A: Pure structured (optimistic)
  → Assume ISO 20022 handles all
  → Build no unstructured capture
  → Risk: Investigations fall through cracks

Option B: Hybrid from start (realistic)
  → Structured core with unstructured extensions
  → Clear escalation triggers
  → Higher build cost, more complete

Option C: Structured + email integration
  → Parse incoming investigation emails
  → Thread into structured cases
  → Bridge traditional communication

Option D: Outsource complexity
  → Automated handles routine
  → Complex goes to bank ops team
  → Accept dependency on bank capability
```

## The Knowledge Capture Problem

When humans resolve investigations, how do we:
1. Capture what they learned?
2. Prevent same issue next time?
3. Build institutional knowledge?
4. Enable future automation?

```
Human resolves: "Called Maria at Correspondent Bank,
                she fixed the BIC code on their side"

→ How do we capture this for:
  - Audit trail
  - Future similar issues
  - Process improvement
  - Automation candidates
```

## Connected Questions

- How do SAR investigations interface with payment investigations?
- What's the typical investigation volume by category?
- How do investigation patterns feed into payment rail selection?

---

*Priority: MEDIUM — Affects operations architecture*
*Research type: Process analysis + vendor capability + ISO 20022 deep dive*
