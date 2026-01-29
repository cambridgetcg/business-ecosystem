# LLM-Native Application Architecture

## Knowledge Gap Identified

**The uncertainty**: Applications built around LLMs require different architectural patterns than traditional software. The patterns for RAG, prompt management, context handling, and multi-model orchestration felt incomplete. What does "LLM-native" architecture actually look like in production?

---

## Research Findings

### The Compound AI System Paradigm

The industry has moved from "LLM applications" to "Compound AI Systems":

```
Traditional LLM App:
User → Prompt → LLM → Response

Compound AI System:
User → Router → [Retriever, LLM, Tools, Validators] → Synthesizer → Response
```

**Key insight**: The LLM is one component, not the entire system.

### Core Architectural Patterns

#### Pattern 1: RAG (Retrieval-Augmented Generation)

```
                    ┌─────────────────┐
                    │   Vector Store  │
                    │   (embeddings)  │
                    └────────┬────────┘
                             │ retrieve
Query → Embedding ──────────►│
                             ▼
                    ┌─────────────────┐
                    │   LLM Context   │
                    │  query + docs   │
                    └────────┬────────┘
                             │ generate
                             ▼
                         Response
```

**RAG has evolved:**
- **Naive RAG**: Query → Retrieve → Generate
- **Advanced RAG**: Query Rewriting → Multi-hop Retrieval → Re-ranking → Generate
- **Agentic RAG**: LLM decides what to retrieve, when, and how much

#### Pattern 2: Multi-Agent Orchestration

```
User Query
    │
    ▼
┌─────────────────────────────────────────┐
│            Orchestrator Agent           │
│  (routes, decomposes, coordinates)      │
└─────────────────────────────────────────┘
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│Research│ │ Code   │ │ Data   │
│ Agent  │ │ Agent  │ │ Agent  │
└────────┘ └────────┘ └────────┘
```

#### Pattern 3: Guardrails Architecture

```
User Input
    │
    ▼
┌─────────────────┐
│  Input Guard    │ ← Validates, filters, classifies
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │   LLM   │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│ Output Guard    │ ← Validates, filters, checks facts
└────────┬────────┘
         │
         ▼
    Response
```

### The Observability Stack

LLM systems require specialized observability:

| Component | Traditional | LLM-Native |
|-----------|-------------|------------|
| Metrics | Latency, errors | + Token usage, cost, quality scores |
| Logs | Request/response | + Prompts, completions, reasoning traces |
| Traces | Service calls | + Agent steps, tool calls, retrieval |
| Evaluation | Unit tests | + LLM-as-judge, human eval, benchmarks |

**Tools that emerged:**
- LangSmith (LangChain)
- Phoenix (Arize)
- Weights & Biases
- Helicone
- Portkey

### Prompt Engineering Architecture

Prompts are now first-class software artifacts:

```
prompts/
├── system/
│   ├── base.txt
│   └── compliance_reviewer.txt
├── templates/
│   ├── contract_analysis.jinja2
│   └── risk_assessment.jinja2
├── few_shot/
│   └── classification_examples.json
└── config/
    └── prompt_versions.yaml
```

**Key practices:**
1. Version control prompts like code
2. A/B test prompt variations
3. Separate prompt logic from application logic
4. Use templating (Jinja2, Handlebars) for dynamic prompts

### Context Window Management

With models supporting 128K+ tokens, context management matters:

```python
# Anti-pattern: Stuffing everything
context = all_documents + all_history + all_context

# Pattern: Strategic context composition
context = compose_context(
    system=system_prompt,
    relevant_docs=retrieve_top_k(query, k=5),
    recent_history=last_n_messages(3),
    user_query=query
)
```

**Techniques:**
- Hierarchical summarization for long histories
- Semantic chunking for documents
- Recency weighting for conversation history
- Dynamic k in retrieval based on query complexity

### The Evaluation Problem

LLM outputs are non-deterministic. Evaluation approaches:

1. **LLM-as-Judge**: Use another LLM to evaluate outputs
2. **Human Evaluation**: Golden dataset with human labels
3. **Automated Metrics**: BLEU, ROUGE, semantic similarity
4. **Task-Specific**: Accuracy for classification, pass rate for code

**Pattern: Evaluation Pipeline**
```
New Prompt/Model
      │
      ▼
┌─────────────────┐
│ Golden Dataset  │ (curated examples with expected outputs)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Eval Runner     │ → Metrics
└────────┬────────┘
         │
         ▼
Pass/Fail Decision
```

### What This Means for Business-Ecosystem

For compliance/legal/financial applications:

1. **Guardrails are Mandatory**
   - Financial advice has regulatory implications
   - Outputs must be validated before presentation
   - Hallucination detection is critical

2. **RAG for Legal/Compliance Knowledge**
   - Regulations change frequently
   - RAG keeps LLM grounded in current rules
   - Citation is mandatory (which document, which section)

3. **Audit Trail for LLM Decisions**
   - Every LLM interaction logged
   - Prompt + context + response saved
   - Reasoning trace for explainability

4. **Human-in-the-Loop**
   - LLM suggests, human approves
   - Especially for contract modifications, compliance determinations
   - Approval workflow with LLM-assisted drafting

5. **Cost Management**
   - Financial applications may need many LLM calls
   - Caching, model routing (cheap for simple, expensive for complex)
   - Cost attribution per entity/feature

---

## Gaps That Remain

1. **Determinism in non-deterministic systems**: How do you test LLM-based business logic?
2. **Liability and compliance**: Who's responsible when LLM gives bad advice?
3. **Long-term context**: How to maintain context across sessions/days/months?
4. **Fine-tuning vs RAG decision framework**: When to use which?

---

## Sources

- Anthropic's Claude documentation
- LangChain/LangGraph patterns
- Various AI engineering blogs and case studies
- Academic papers on RAG and compound AI systems

---

*Research Date: January 2026*
*Gap Status: Partially Filled - Patterns emerging, production best practices still evolving*
