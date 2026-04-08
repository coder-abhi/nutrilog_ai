**Hybrid Parsing Pipeline**

**Date:** 28 Feb 2026
**Status:** Decided

Decision

We will implement a hybrid parsing pipeline that processes user input using local methods (embedding-based activity detection and regex-based number extraction) and falls back to an LLM only when confidence is low or required signals are missing.


# **Why**

A fully LLM-based approach introduces higher latency, cost, and lack of control, while a purely rule-based system is too brittle for real-world, unstructured language. The hybrid approach balances performance, cost efficiency, and accuracy by handling common cases locally and reserving LLM usage for complex or ambiguous inputs.

Alternative Considered


1. A fully LLM-based approach was considered for simplicity and accuracy, but it was rejected due to high latency, cost, and lack of control over outputs.
2. A purely rule-based system was explored for speed and zero cost, but it was too brittle to handle natural, unstructured user language reliably.
3. Traditional NLP solutions like spaCy were evaluated, but they require labeled data and add unnecessary complexity without solving mixed input cases effectively.
4. An embeddings-only approach was considered for semantic matching, but it cannot extract numerical values or complete structure, making it insufficient on its own.

# **Consequences**

### **Positive**

* Reduced LLM usage → lower cost and faster response
* Better control and debuggability
* Scalable architecture with modular components
* Strong demonstration of system design skills

### **Trade-offs**

* Increased implementation complexity
* Requires maintaining multiple layers (regex + embeddings + fallback)
* Slight overhead in decision logic


User Input (free text)
        ↓
Segment Split (and, comma, etc.)
        ↓
For each segment:
        ↓
[Embedding → Activity Detection]
[Regex → Number Extraction]
        ↓
Decision Engine:
    IF activity detected AND (duration OR distance OR reps) AND confidence > threshold
        → Local Processing (deterministic calculation)
    ELSE
        → LLM Fallback
        ↓
Merge Results
        ↓
Structured JSON Output
        ↓
Store in DB + Update Dashboard
