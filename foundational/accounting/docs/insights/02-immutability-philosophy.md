# Insight 02: Immutability as Architectural Trust

> Curiosity Question: Why is immutability enforced architecturally rather than through access control? What does this say about trust hierarchies?

## The Insight

Immutability enforced at the class level represents a **fundamental shift in trust model**: from "trust the right people" to "trust no one, not even the system itself."

```
ACCESS CONTROL MODEL                 ARCHITECTURAL MODEL
        │                                   │
        ▼                                   ▼
  "Admins can modify"              "No one can modify"
        │                                   │
        ▼                                   ▼
  Trust in ROLE                     Trust in STRUCTURE
        │                                   │
        ▼                                   ▼
  Can be compromised               Cannot be compromised
  (social engineering,             (would require code change,
   privilege escalation)            which is audited)
```

## The Discovery

### Why Access Control Fails for Financial Records

1. **Privilege escalation**: Attackers gain admin rights
2. **Social engineering**: Legitimate admins are manipulated
3. **Insider threats**: Admins themselves commit fraud
4. **Temporal attacks**: "I'll just fix this one thing" becomes pattern
5. **Audit gap**: Hard to prove nothing was modified

### Why Architectural Immutability Succeeds

1. **Code is the law**: No amount of privilege changes the `ImmutableEntity` base class
2. **Modification requires deployment**: Which is logged and reviewed
3. **Self-documenting**: The constraint is visible in the code itself
4. **Defense in depth**: Even if database is compromised, application won't write updates
5. **Audit certainty**: If it exists, it was created once and never changed

## The Pattern: ImmutableEntity

From `src/domain/shared/entity.py`:

```python
class ImmutableEntity(Base):
    """
    Base class for entities that cannot be modified after creation.

    These entities have no updated_at field and no version field.
    Once created, they are permanent records.
    """
    __abstract__ = True

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Notably absent: updated_at, version
    # The absence IS the constraint
```

### What Makes This Powerful

1. **The constraint is structural**: No `updated_at` means no mechanism for tracking updates
2. **SQLAlchemy respects it**: Without version field, optimistic locking is impossible
3. **The absence speaks**: Developers see "no updated_at" and understand immediately
4. **Inheritance enforces**: All financial records inherit this constraint

## Trust Hierarchy Implications

### The Old Model: Trust Hierarchy

```
               SYSTEM OWNER
                    │
                    ▼
              ADMIN ROLE
                    │
                    ▼
              USER ROLE
                    │
                    ▼
                 DATA
```

Problem: Each level must trust the one above.

### The New Model: Trust Elimination

```
           IMMUTABLE RECORD
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
    OWNER     ADMIN      USER
       │         │         │
       └─────────┴─────────┘
              │
              ▼
       ALL EQUALLY CONSTRAINED
```

Nobody is trusted to modify - the constraint applies universally.

## The Philosophical Insight

This is **structural honesty** - designing systems that make dishonesty architecturally difficult rather than merely forbidden.

| Approach | Mechanism | Failure Mode |
|----------|-----------|--------------|
| Policy | "You must not modify records" | Disobeyed |
| Access Control | "You cannot modify records" | Circumvented |
| Architecture | "Records cannot be modified" | Code change (visible) |

The difference:
- Policy requires **ongoing compliance**
- Access control requires **ongoing enforcement**
- Architecture requires **deliberate, visible change to violate**

## Where Else This Applies

### Clearly Immutable

| Domain | Entity Type | Why Immutable |
|--------|-------------|---------------|
| Accounting | Journal entries | Audit trail integrity |
| Healthcare | Medical records | Patient safety, legal compliance |
| Legal | Court filings | Evidentiary integrity |
| Finance | Trading records | Market integrity |
| Blockchain | Transactions | Consensus mechanism |

### Possibly Should Be Immutable

| Domain | Entity Type | Current State |
|--------|-------------|---------------|
| HR | Performance reviews | Often mutable (problematic) |
| Education | Grades | Often mutable (problematic) |
| Insurance | Claims | Often mutable (fraud risk) |
| Government | Permits/licenses | Often mutable (corruption risk) |

## The Meta-Insight: Immutability as Default?

Perhaps the question should be inverted:

**Current assumption**: Entities are mutable unless specifically protected
**Better assumption**: Entities are immutable unless mutability is specifically required

Most data that "needs" to be mutable actually needs:
- Correction via new record (accounting model)
- Version history (event sourcing model)
- Soft deletion (audit model)

Very few things truly need in-place mutation.

## Application to This System

### Current Implementation

```python
# JournalEntry extends ImmutableEntity
class JournalEntry(ImmutableEntity):
    # No update methods exist
    # Status changes create new records (reversals)
```

### Enhancement Opportunity

Document the **why** more explicitly:

```python
class ImmutableEntity(Base):
    """
    Base class for entities that MUST NOT be modified after creation.

    This is not a suggestion or access control - it is architectural.
    To "modify" a record, create a new record that references/reverses it.

    Trust Model: This constraint applies equally to all users, admins,
    and the system itself. Modification would require changing this
    base class, which is a code change subject to review.

    Entities inheriting this class:
    - JournalEntry: Financial transactions
    - [Future: AuditEvent, MedicalRecord, etc.]
    """
```

---

## Questions This Raises

1. Should we have an `ImmutableEntity` registry that lists all immutable types?
2. How do we handle the gap between "architecturally immutable" and "legally required to be immutable"?
3. Could database triggers provide a second layer of immutability enforcement?

---

*Insight recorded: January 2026*
*Source: Integration of implementation experience with curiosity question research*
