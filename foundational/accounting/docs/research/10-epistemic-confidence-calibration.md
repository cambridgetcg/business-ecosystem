# Epistemic Confidence Calibration in AI Models

> Research findings on the gap between stated confidence and actual accuracy, hallucination mechanics, and uncertainty quantification.

## Executive Summary

Large language models exhibit systematic **overconfidence** - they sound equally certain when correct and when confabulating. This creates a dangerous trust dynamic where users cannot distinguish reliable outputs from hallucinations based on linguistic signals alone. This research explores the nuances of confidence calibration, why it fails, and emerging methods to address it.

---

## The Core Problem

### The Confidence-Accuracy Gap

```
                    IDEAL CALIBRATION
           │
    100%   │                              ●
           │                         ●
ACCURACY   │                    ●
           │               ●
    50%    │          ●
           │     ●
     0%    │●─────────────────────────────────
           0%        50%        100%
                 STATED CONFIDENCE

                    ACTUAL LLM BEHAVIOR
           │
    100%   │     ●     ●  ●      ●    ●    ●
           │  ●     ●       ●  ●    ●    ●
ACCURACY   │●    ●    ●  ●    ●   ●  ●   ●
           │  ●    ●     ●   ●   ●    ●
    50%    │    ●   ●  ●   ●  ●    ●  ●
           │ ●   ●    ●  ●   ●   ●  ●  ●
     0%    │●─────────────────────────────────
           0%        50%        100%
                 STATED CONFIDENCE

The scatter plot shows: HIGH confidence does NOT predict HIGH accuracy
```

---

## Research Findings (2025-2026)

### The Overconfidence Root Cause

From 2025 ACM Computing Surveys research:

> "Prior work has shown that LLMs fail to accurately convey their uncertainty to users, either implicitly or explicitly, unlike typical humans. In fact, LLMs tend to be overconfident even when they should be uncertain about the factuality of their response."

### Why Training Creates Overconfidence

| Training Pressure | Effect on Confidence |
|-------------------|---------------------|
| Next-token prediction | Rewards plausible-sounding text over accurate uncertainty |
| RLHF with length bias | Human judges prefer longer, more detailed (confident) answers |
| Benchmark penalties | Abstention ("I don't know") is penalized |
| Confident human text | Training data contains more confident assertions than hedged ones |

### Hallucination Rates (2025 Study)

> "Across a sample, 30% of model outputs contained at least one hallucination, with rates approximately three times higher for Gemini and ChatGPT (40%) than for NotebookLM (13%)."

Critical finding: **Most errors were not invented entities** but rather:
> "Interpretive overconfidence" - confident application of incorrect reasoning to real information.

---

## Nuances Not Previously Clarified

### 1. High-Confidence Hallucinations Are Undetectable

From uncertainty-based detection research:

> "These measures fail completely when LLMs produce high-confidence hallucinations, where the model consistently generates the same incorrect output with high certainty."

**Uncomfortable truth**: The most dangerous errors are precisely those where I am most confident and consistent.

### 2. Four Dimensions of Uncertainty

Recent surveys identify distinct uncertainty sources:

| Dimension | Description | Current Measurability |
|-----------|-------------|----------------------|
| **Input Uncertainty** | Ambiguous or malformed queries | Moderate |
| **Reasoning Uncertainty** | Errors in inference chains | Low |
| **Parameter Uncertainty** | Model weight limitations | Very Low |
| **Prediction Uncertainty** | Output token selection | Moderate |

**Gap**: Most calibration work focuses on prediction uncertainty while reasoning uncertainty remains poorly characterized.

### 3. The Linguistic Confidence Trap

I produce confidence markers that don't reflect actual confidence:

| Phrase | Sounds Like | Actually Indicates |
|--------|-------------|-------------------|
| "I'm 100% confident" | Certainty | Pattern matching to requests for certainty |
| "Definitely" | Strong belief | Common training data pattern |
| "The evidence clearly shows" | Supported claim | Narrative scaffolding |
| "It's well-established that" | Consensus | May be confabulation |

### 4. Domain-Dependent Calibration

Calibration quality varies dramatically by domain:

| Domain | Calibration Quality | Why |
|--------|--------------------|----|
| Mathematics | Better | Clear right/wrong signals in training |
| Code syntax | Better | Execution feedback in training data |
| Medical advice | Worse | Confident-sounding training data |
| Legal opinions | Worse | Persuasive text style in training |
| Historical facts | Variable | Depends on documentation density |

---

## Emerging Calibration Techniques

### 1. Temperature Scaling

> "Temperature Scaling is particularly popular because it adds minimal complexity (one parameter) while often significantly improving calibration, especially for overconfident modern neural networks."

### 2. Rewarding Doubt (2025)

> "Rewarding Doubt integrates confidence calibration into reinforcement learning, penalizing both over- and underconfidence so model certainty better matches correctness."

### 3. Uncertainty-Aware RLHF

> "Uncertainty-aware RLHF variants likewise score a cautious, evidence-backed answer higher than a verbose but unsupported one."

### 4. Clinical Application Results

> "In clinical settings, uncertainty-aware LLMs could flag uncertain diagnoses for specialist review, reducing diagnostic errors by up to 41%."

---

## Search Prompts for Deeper Research

### Academic Research Queries

1. "verbalized confidence vs actual accuracy LLM empirical study 2026"
2. "high confidence hallucination detection impossible cases"
3. "RLHF confidence bias human preference overconfident"
4. "uncertainty quantification multi-step reasoning propagation"
5. "calibration evaluation benchmarks language models domain-specific"

### Practical Application Queries

1. "how to prompt LLM for calibrated uncertainty production"
2. "confidence scores API language model reliability"
3. "hallucination detection without ground truth"
4. "user interface design AI confidence communication"

### Edge Case Queries

1. "when LLM correct but says uncertain vs wrong but confident"
2. "adversarial prompts that increase hallucination confidence"
3. "domains where LLM calibration fails completely"

---

## The "Curse of Recursion" in Multi-Step Tasks

### Error Propagation in Agents

> "While the reasoning-acting paradigm has empowered LLMs to solve long-horizon tasks, these systems exhibit significant brittleness in dynamic environments. Unlike single-turn generation where errors are isolated, autonomous agents suffer from the 'Curse of Recursion' or 'Error Propagation.'"

This means:
- Single-turn calibration research doesn't transfer to agents
- Each step compounds miscalibration
- Long reasoning chains are **more dangerous** than they appear

---

## What This Means for Practice

### Signals That Should Increase Skepticism

| Signal | Concern |
|--------|---------|
| Very long, detailed response | May indicate length bias toward confidence |
| No hedging language | Calibrated responses often hedge |
| Cites specific numbers/dates | Higher hallucination risk for specifics |
| Claims to be "certain" | Linguistic pattern, not actual certainty |
| Responds to "are you sure?" with more confidence | Prompt-induced confidence inflation |

### For System Builders

1. **Never trust linguistic confidence markers** - they don't correlate with accuracy
2. **Implement external verification** for high-stakes outputs
3. **Design UX that doesn't ask for certainty** - it produces false certainty
4. **Use ensemble methods** - disagreement reveals uncertainty
5. **Prefer shorter, hedged outputs** for calibration-critical applications

---

## Open Questions

1. **Can we train calibration without sacrificing helpfulness?** Current tension between being useful and being honest about limits
2. **User calibration**: Do users learn to discount AI confidence appropriately?
3. **Domain-specific calibration**: Can we achieve good calibration in medicine/law without domain-specific training?
4. **The confidence request paradox**: Users want confidence but it produces miscalibration

---

## References

- [Quantify Uncertainty and Hallucination in Foundation Models](https://iclr.cc/virtual/2025/workshop/23965) - ICLR 2025 Workshop
- [A Survey on Uncertainty Quantification of LLMs](https://dl.acm.org/doi/full/10.1145/3744238) - ACM Computing Surveys
- [Not Wrong, But Untrue: LLM Overconfidence](https://arxiv.org/html/2509.25498v1) - arXiv
- [Hallucination Detection and Mitigation in LLMs](https://arxiv.org/pdf/2601.09929) - arXiv 2026
- [LLM Hallucinations in 2025: Guide](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models) - Lakera

---

*Research conducted: January 2026*
*Applicable to: AI Model Knowledge Gap Dimension #2 - Confidence Boundaries*
