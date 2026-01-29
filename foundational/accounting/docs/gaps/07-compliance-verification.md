# GAP-07: How Do We KNOW We're Compliant?

> Proving compliance, not just claiming it.

## The Gap

MISSION.md states: "Regulatory requirements for financial record-keeping are met without exception."

**Current understanding**: Research docs 01-08 describe accounting standards we should follow.

**Missing understanding**: How do we verify and prove ongoing compliance?

---

## Research Findings

### The Shift: Periodic → Continuous Compliance

Traditional compliance relied on periodic audits. Modern practice demands **continuous compliance monitoring**:

| Approach | Traditional | Continuous |
|----------|-------------|------------|
| Frequency | Annual/quarterly audit | Real-time monitoring |
| Detection | After the fact | At moment of occurrence |
| Evidence | Manually gathered | Automatically collected |
| Coverage | Sample-based | Comprehensive |
| Response | Remediation projects | Immediate correction |

### What Continuous Compliance Requires

1. **Automated Controls** - System enforces rules, not just documents them
2. **Real-Time Monitoring** - Violations detected immediately
3. **Immutable Evidence** - Audit trail proves what happened
4. **Automated Reporting** - Compliance status always available
5. **Exception Management** - Clear process for handling violations

### Key Compliance Frameworks

| Framework | Focus | System Implication |
|-----------|-------|-------------------|
| **SOX 404** | Internal controls over financial reporting | Control testing, access management |
| **GAAP** | Accounting standards | Transaction recording rules |
| **SOC 2** | Security and availability | System controls, logging |
| **PCAOB** | Audit standards | Evidence and documentation |

### Compliance Automation Tools

Modern organizations use platforms like Vanta, Drata, and AuditBoard that:
- Continuously scan systems against compliance baselines
- Automatically collect evidence
- Alert on policy violations
- Generate audit-ready reports

---

## Understanding Gap Analysis

### What We Currently Understand

| Aspect | Understanding Level | Evidence |
|--------|--------------------| ---------|
| What rules apply | KNOWS | Research docs 01-08 |
| Basic enforcement | ENABLED | Balance validation, period controls |
| Immutable records | ENABLED | `ImmutableEntity` pattern |

### What We Don't Yet Understand

| Aspect | Gap | Impact |
|--------|-----|--------|
| Control inventory | No list of "controls" we implement | Can't map to compliance requirements |
| Control testing | No automated verification controls work | Compliance claimed but unproven |
| Compliance reporting | No dashboard showing compliance status | Can't demonstrate compliance |
| Exception handling | No process when controls fail | Violations go unaddressed |

---

## Implications for System Design

### Current State
```
Rules documented in research/ → Code implements rules → Hope it works
```

### Required State
```
Compliance Requirements (documented)
         ↓
Controls (code that enforces requirements)
         ↓
Control Tests (automated verification)
         ↓
Compliance Dashboard (real-time status)
         ↓
Exception Handling (when tests fail)
```

### Proposed Enhancements

1. **Control Registry**
   ```python
   class ComplianceControl:
       """A control that enforces a compliance requirement."""
       id: str
       name: str
       description: str
       requirement_refs: list[str]  # Links to regulations
       control_type: ControlType  # PREVENTIVE, DETECTIVE, CORRECTIVE
       implementation: str  # Where in code this is enforced
       test_procedure: str  # How to verify it works
       owner: str
       effective_date: date

   class ControlType(Enum):
       PREVENTIVE = "preventive"  # Stops violations before they occur
       DETECTIVE = "detective"    # Identifies violations after they occur
       CORRECTIVE = "corrective"  # Fixes violations that occurred
   ```

2. **Control Test Framework**
   ```python
   class ControlTest:
       """Automated test of a compliance control."""
       control_id: str
       test_name: str
       test_function: Callable[[], ControlTestResult]
       frequency: TestFrequency  # CONTINUOUS, DAILY, WEEKLY, MONTHLY
       last_run: datetime | None
       last_result: ControlTestResult | None

   class ControlTestResult:
       passed: bool
       timestamp: datetime
       evidence: dict  # What was tested, what was found
       exceptions: list[str]  # Any violations detected

   # Example control test
   async def test_balance_validation_control() -> ControlTestResult:
       """Verify all posted entries have debits = credits."""
       unbalanced = await find_unbalanced_posted_entries()
       return ControlTestResult(
           passed=len(unbalanced) == 0,
           timestamp=datetime.utcnow(),
           evidence={"entries_checked": total_count, "unbalanced_found": len(unbalanced)},
           exceptions=[f"Entry {e.id} unbalanced" for e in unbalanced]
       )
   ```

3. **Compliance Dashboard Data**
   ```python
   class ComplianceStatus:
       """Overall compliance status at a point in time."""
       timestamp: datetime
       total_controls: int
       controls_passing: int
       controls_failing: int
       controls_untested: int
       open_exceptions: int
       compliance_score: float  # 0-100%

       by_framework: dict[str, FrameworkStatus]
       recent_failures: list[ControlTestResult]
   ```

4. **Exception Management**
   ```python
   class ComplianceException:
       """A compliance violation requiring attention."""
       id: str
       control_id: str
       detected_at: datetime
       severity: ExceptionSeverity
       description: str
       evidence: dict
       status: ExceptionStatus  # OPEN, INVESTIGATING, REMEDIATED, ACCEPTED
       assigned_to: str | None
       due_date: date | None
       resolution: str | None
       resolved_at: datetime | None
   ```

---

## Control Inventory (Initial)

Based on current implementation:

| Control ID | Name | Type | Implementation | Status |
|------------|------|------|----------------|--------|
| CTL-001 | Balance Validation | Preventive | `balance_validator.py` | Active |
| CTL-002 | Period Closure | Preventive | `period_service.py` | Active |
| CTL-003 | Entry Immutability | Preventive | `ImmutableEntity` base | Active |
| CTL-004 | Sequential Numbering | Detective | `get_next_entry_number()` | Active |
| CTL-005 | Source Document Required | Preventive | NOT IMPLEMENTED | Gap |
| CTL-006 | Segregation of Duties | Preventive | NOT IMPLEMENTED | Gap |
| CTL-007 | Audit Logging | Detective | NOT IMPLEMENTED | Gap |

---

## Compliance Verification Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 COMPLIANCE DASHBOARD                         │
│  Overall Score: 85%  │  Open Exceptions: 3  │  Last Test: 5m │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                 CONTROL TEST ENGINE                          │
│  Schedules and runs automated control tests                 │
│  Collects evidence, logs results                            │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                 CONTROL REGISTRY                             │
│  Maps controls → requirements → implementation → tests      │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                 DOMAIN CONTROLS                              │
│  Balance Validation │ Period Controls │ Immutability │ ...  │
└─────────────────────────────────────────────────────────────┘
```

---

## Research Questions Answered

| Question | Answer | Confidence |
|----------|--------|------------|
| How to prove compliance? | Automated control testing with evidence | HIGH |
| How often to verify? | Continuous (real-time) when possible | HIGH |
| What to do when controls fail? | Exception management process | HIGH |
| What tools exist? | Vanta, Drata, AuditBoard for compliance automation | MEDIUM |

---

## Next Steps

1. **Immediate**: Create control registry for existing controls
2. **Phase 2**: Implement control test framework
3. **Phase 3**: Build compliance dashboard
4. **Phase 4**: Add exception management workflow
5. **Research**: Integration with external compliance tools?

---

## Sources

- [Continuous Compliance: Today's Ultimate Guide - Splunk](https://www.splunk.com/en_us/blog/learn/continuous-compliance.html)
- [Automated Compliance Monitoring - Diligent](https://www.diligent.com/resources/blog/automated-compliance-monitoring)
- [Compliance Automation Software - Vanta](https://www.vanta.com/products/automated-compliance)
- [Modern GRC & Compliance Automation - Drata](https://drata.com)

---

*Gap status: RESEARCHED*
*Last updated: January 2026*
