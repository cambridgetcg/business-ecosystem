# Question: How Do You Test A Contingency Funding Plan Without Triggering Stress?

## The Gap

Research established that **improvisation fails in crisis**—you need pre-built playbooks. But how do you validate a playbook works without actually experiencing the crisis?

## The Specific Question

```
For a Contingency Funding Plan that includes:
  → Credit facility draw procedures
  → Cash pool unwinding steps
  → Asset sale protocols
  → Board escalation triggers

How do you test that:
  → The steps are correct and complete?
  → The timing estimates are accurate?
  → The dependencies are properly mapped?
  → People know their roles?
  → WITHOUT actually drawing the facility or alarming stakeholders?
```

## Why This Matters

### The Testing Paradox

**If you don't test:**
- Discover gaps during actual crisis
- People hesitate, unsure of authority
- Documentation is outdated
- Timing assumptions are wrong

**If you test poorly:**
- Banks wonder why you're drawing facilities
- Markets may interpret as distress signal
- Board may lose confidence in treasury
- Regulatory attention if visible

### The Confidence Gap

| Element | Confidence Without Testing | Confidence With Testing |
|---------|---------------------------|------------------------|
| Documentation accuracy | Low | High |
| Timing estimates | Very low | Medium |
| Authority clarity | Medium | High |
| System access | Unknown | Verified |
| Communication templates | Low | High |

## Current Understanding

| Testing Method | Tests What | Risks | Realism |
|---------------|------------|-------|---------|
| **Tabletop exercise** | Decision logic, roles | None | Low |
| **Walk-through** | Process steps | Low | Low-Medium |
| **Limited drill** | Specific procedures | Medium | Medium |
| **Full simulation** | End-to-end | High | High |
| **Shadow execution** | Real systems, no action | Medium | High |

## The Testing Framework Gap

### What Needs Testing

**1. Decision Triggers**
- Are monitoring systems correctly configured?
- Do alerts reach the right people?
- Are thresholds still appropriate?

**2. Authority Chain**
- Who can authorize what?
- Are backups defined?
- Are approval limits current?

**3. Execution Procedures**
- Are draw notices drafted?
- Are bank contact lists current?
- Are system accesses valid?

**4. Communication**
- Board notification templates?
- Bank relationship scripts?
- Internal escalation chains?

**5. Timing**
- How long does each step actually take?
- What can run in parallel?
- Where are the bottlenecks?

## Hypotheses to Investigate

### Hypothesis 1: Tabletop Exercise Protocol
```
Quarterly tabletop exercise:
  → Scenario presented (e.g., major customer bankruptcy)
  → Each role describes their actions
  → Facilitator tracks timing, dependencies
  → Gap analysis documented
  → No actual system actions taken
```

**Pros:** Safe, repeatable, involves full team
**Cons:** Low fidelity, doesn't test systems

### Hypothesis 2: Component Testing
```
Test individual components separately:
  → Draft draw notice (but don't send)
  → Log into banking systems
  → Run cash pool report
  → Generate asset sale list
  → Update contact database
```

**Pros:** Tests real systems, low risk
**Cons:** Doesn't test integration, timing

### Hypothesis 3: Shadow Mode Testing
```
During normal period:
  → Run CFP parallel to normal operations
  → Document what WOULD happen
  → Time each step
  → Don't execute final actions
```

**Pros:** High realism, tests actual timing
**Cons:** Resource intensive, some risk

### Hypothesis 4: Bank Coordination Testing
```
With bank relationship manager:
  → "We want to test our draw process"
  → Walk through documentation together
  → Confirm their receipt/processing time
  → Update our assumptions
```

**Pros:** Tests external dependencies
**Cons:** Requires bank cooperation

### Hypothesis 5: Regulatory-Style Stress Test
```
Annual comprehensive test:
  → External facilitator runs scenario
  → All roles participate
  → Some live components executed
  → Full documentation of outcomes
  → Board briefing on results
```

**Pros:** Most thorough
**Cons:** Most expensive, highest visibility

## Research Directions

1. **Federal Reserve CFP guidance** — What do regulators expect for testing?
2. **Treasury management consultants** — Best practices for CFP validation?
3. **Bank-side perspective** — How do banks view customer CFP tests?
4. **Peer company practices** — How do comparable companies test?

## The Implementation Question

This question affects CFP infrastructure:

```
Testing Infrastructure Needed:
  → Scenario library (credible stress scenarios)
  → Role assignments and backup chains
  → Timing benchmarks
  → Success criteria
  → Gap tracking
  → Remediation workflow

Testing Schedule:
  → Tabletop: Quarterly
  → Component: Semi-annual
  → Comprehensive: Annual
  → Post-event review: After any CFP activation
```

## The Documentation Gap

What does a CFP testing record look like?

```typescript
CFPTestRecord {
  test_id: string
  test_date: date
  test_type: 'tabletop' | 'component' | 'comprehensive'
  scenario: ScenarioDescription
  participants: Participant[]
  steps_tested: TestStep[]
  timing_results: TimingResult[]
  gaps_identified: Gap[]
  remediation_plan: RemediationPlan
  next_test_date: date
}
```

## Connected Questions

- How do CFP triggers integrate with automated forecasting?
- When should CFP testing results be shared with the board?
- How do banks react to proactive CFP testing discussions?

---

*Priority: MEDIUM — Important for CFP credibility, not urgent*
*Research type: Regulatory guidance + practitioner interviews + peer practices*
