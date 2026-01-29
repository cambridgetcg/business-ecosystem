# Reasoning Under Deep Uncertainty in AI Models

> Research findings on error propagation in multi-step reasoning, chain-of-thought failures, and the limits of probabilistic reasoning.

## Executive Summary

LLMs struggle fundamentally with **reasoning under uncertainty** - not just expressing uncertainty, but maintaining coherent reasoning when the problem structure itself is unclear. Multi-step reasoning compounds errors invisibly, probabilistic reasoning violates basic axioms, and the "chain-of-thought" paradigm creates a false sense of rigorous inference. This research explores these nuances and their implications.

---

## The Core Problem

### Error Propagation in Reasoning Chains

```
Step 1: Inference A (95% correct)
         │
         ▼
Step 2: Inference B (95% correct, given A)
         │
         ▼
Step 3: Inference C (95% correct, given B)
         │
         ▼
Step 4: Inference D (95% correct, given C)
         │
         ▼
Step 5: Inference E (95% correct, given D)

CUMULATIVE ACCURACY: 0.95^5 = 77%

And that's with 95% per-step accuracy.
At 90% per-step: 0.90^5 = 59%
At 80% per-step: 0.80^5 = 33%
```

**The longer the reasoning chain, the less reliable the conclusion.**

---

## Research Findings (2025-2026)

### The "Curse of Recursion"

From 2025 research on agentic systems:

> "Recent research analyzes the persistent error rate problem that prevents LLMs from scaling to extended sequential tasks, where experiments demonstrate performance collapse beyond a few hundred dependent steps."

This isn't a minor limitation - it's a **fundamental barrier** to long-horizon reasoning.

### Probabilistic Reasoning Failures

2025 evaluations found:

> "Probabilistic reasoning and handling uncertainty remain challenging for LLMs. Evaluations found that current models frequently violate basic probability rules such as complementarity and monotonicity."

Basic axioms violated include:
- **Complementarity**: P(A) + P(not A) = 1
- **Monotonicity**: If A implies B, then P(A) ≤ P(B)
- **Additivity**: P(A or B) = P(A) + P(B) - P(A and B)

> "Studies show that while LLMs understand probability concepts, they struggle to generate samples aligning with specified distributions."

### Chain-of-Thought Limitations

> "In chain-of-thought reasoning, early mistakes can derail entire sequences. A final post-hoc score is insufficient; models require continuous uncertainty signals at intermediate steps to backtrack."

The chain-of-thought method creates an illusion of rigorous reasoning while actually:
- Committing to early inferences without backtracking
- Propagating errors through subsequent steps
- Producing confident conclusions from shaky foundations

---

## Nuances Not Previously Clarified

### 1. The Inquiry Drift Problem

From uncertainty propagation research:

> "Even when single-step uncertainty remains low throughout a process, excessively high inquiry drift and inference gap in certain steps provide additional situational information that increases uncertainty. This causes the LLM's reasoning process to deviate from the correct direction."

**Inquiry drift**: The gradual shift away from the original question through intermediate reasoning steps.

| Step | Original Question Focus | After Drift |
|------|------------------------|-------------|
| 1 | What is X? | What is X? |
| 2 | X relates to Y | Let me explain Y |
| 3 | Y is interesting because Z | Z is the key concept |
| 4 | Z implies W | W is the answer |
| 5 | Therefore W | (No longer answering original question) |

### 2. Compound Uncertainty is Invisible

Unlike humans who feel increasingly uncertain as problems get complex, LLMs:
- Express **constant confidence** across reasoning depth
- Cannot "feel" cumulative uncertainty
- Don't naturally signal when reasoning has become unreliable

### 3. The Backtracking Deficit

Human reasoning naturally backtracks:
- "Wait, that doesn't make sense..."
- "Let me reconsider step 2..."
- "If that were true, then X, but X is false, so..."

LLMs generate text left-to-right without revision:
- Early commitments persist
- Contradictions are explained away rather than triggering revision
- No mechanism for "something feels wrong"

### 4. Analogical Reasoning Boundaries

LLMs rely heavily on analogy, but:

| Analogy Type | Reliability |
|--------------|-------------|
| Surface similarity | Unreliable - may be coincidental |
| Structural similarity | More reliable if structure preserved |
| Deep causal similarity | Requires understanding not just pattern |

**The nuance**: I often can't distinguish surface from structural analogy, leading to plausible but wrong transfers.

---

## Proposed Solutions

### 1. MAKER Framework (2025)

> "MAKER, a breakthrough framework that achieves over one million LLM steps with zero errors through extreme task decomposition combined with multi-agent voting schemes."

Key insight: **Decompose to trivial steps + consensus verification**

### 2. Agentic Uncertainty Quantification

> "AUQ transforms verbalized uncertainty into active, bi-directional control signals, comprising System 1 (Uncertainty-Aware Memory), which implicitly propagates verbalized confidence to prevent blind decision-making, and System 2 (Uncertainty-Aware Reflection), which utilizes explanations as cues to trigger targeted inference-time resolution."

### 3. Continuous Intermediate Verification

Instead of checking only final answers:
- Verify each reasoning step
- Allow backtracking when inconsistency detected
- Maintain uncertainty estimates through chain

---

## Search Prompts for Deeper Research

### Academic Research Queries

1. "error propagation multi-step reasoning LLM measurement 2026"
2. "probability axiom violations large language models formal"
3. "chain of thought backtracking mechanisms neural networks"
4. "uncertainty propagation agentic decision making proof"
5. "compositional generalization failure language models analysis"

### Practical Application Queries

1. "how to limit reasoning chain length for reliability"
2. "verification intermediate steps LLM reasoning production"
3. "multi-agent consensus reasoning error reduction"
4. "when to trust vs distrust LLM reasoning output"

### Edge Case Queries

1. "problems where chain of thought makes reasoning worse"
2. "maximum reliable reasoning steps empirical measurement"
3. "reasoning tasks where LLMs systematically fail"

---

## What This Means for Practice

### Signs Reasoning May Have Gone Wrong

| Signal | Concern |
|--------|---------|
| Long reasoning chains (>5 steps) | Cumulative error likely |
| Step seems to change topic | Inquiry drift occurring |
| Conclusion feels "pulled from nowhere" | Weak intermediate inference |
| Reasoning sounds circular | Model justifying predetermined conclusion |
| Confident complex numerical reasoning | Probabilistic reasoning is weak |

### For System Builders

1. **Limit reasoning chain length** - shorter chains are more reliable
2. **Verify intermediate steps** - don't trust chains end-to-end
3. **Use ensemble reasoning** - multiple reasoning paths expose fragility
4. **Prefer decomposition** - many small tasks > one long chain
5. **Build in human checkpoints** - especially for consequential decisions

### Decomposition Strategy

```
INSTEAD OF:
  Prompt: "Reason through this complex problem step by step"

DO:
  Step 1: What is the core question? [Verify]
  Step 2: What facts are given? [Verify]
  Step 3: What inference can we make? [Verify]
  Step 4: Does this answer the original question? [Verify]
```

---

## The Performance Collapse Horizon

Research reveals a critical finding:

> "Experiments demonstrate performance collapse beyond a few hundred dependent steps."

This establishes a **hard boundary**: LLM reasoning cannot reliably extend beyond ~100-300 dependent steps regardless of model quality.

Implications:
- Some problems are **structurally beyond** LLM reasoning capacity
- Breaking into independent sub-problems is essential
- End-to-end automation of long reasoning tasks is unsafe

---

## Open Questions

1. **Optimal chain length**: What is the maximum reliable reasoning depth for different task types?
2. **Error detection**: Can we detect when reasoning has gone wrong without ground truth?
3. **Backtracking mechanisms**: Can architectures that allow revision improve reasoning?
4. **Human-AI collaboration**: Where should humans be inserted in reasoning chains?

---

## References

- [Reasoning Under Uncertainty: Probabilistic Reasoning in LLMs](https://arxiv.org/html/2509.10739v1) - arXiv
- [Uncertainty Propagation on LLM Agent](https://aclanthology.org/2025.acl-long.302.pdf) - ACL 2025
- [Agentic Uncertainty Quantification](https://arxiv.org/html/2601.15703) - arXiv 2026
- [From Passive Metric to Active Signal: UQ in LLMs](https://arxiv.org/html/2601.15690) - arXiv 2026
- [Unraveling Misinformation Propagation in LLM Reasoning](https://arxiv.org/html/2505.18555) - arXiv

---

*Research conducted: January 2026*
*Applicable to: AI Model Knowledge Gap Dimension #3 - Reasoning Boundaries*
