# AI Usage

This document covers meaningful decisions where AI (Claude for planning; Cursor for implementation) was used on the LLD Practice Platform — what was suggested, what was accepted or rejected, and why.

## 1. Submission format: text vs. diagram vs. code

**What AI suggested:** Support a **combined** format — structured text plus an optional lightweight diagram editor — for richer signal from day one.

**What I accepted / rejected:** Rejected the diagram editor for the MVP; kept **text-only** structured fields. Accepted the idea that format should be pluggable, which became `Submission.format = text_v1` plus a JSON payload (see `docs/DESIGN.md`, Change Test A).

## 2. Evaluation prompt design

**What AI suggested:** An open prompt like “score this design out of 100 with comments.”

**What I accepted / rejected:** Rejected the open-ended score. Accepted a fixed-rubric JSON shape (`criterionId`, `score`, `evidence`, `concern`, `suggestion`, `confidence`) implemented in `OpenAiEvaluator`, with evidence required to reference the learner’s text.

## 3. Domain model granularity — separate `Attempt` from `Submission`?

**What AI suggested:** Collapse attempt and submission into one mutable row.

**What I accepted / rejected:** Rejected the collapse. Kept separate `Attempt`, `Submission`, and `Evaluation` so history preserves each submitted snapshot and its feedback trail.

## 4. Where to draw the deterministic/AI line

**What AI suggested:** Let the LLM also check required sections / minimum length “for consistency.”

**What I accepted / rejected:** Rejected LLM structural checks. Implemented them in `validateDesignForSubmit` / `attemptLifecycle` before enqueue. Judgment-heavy scoring stays in `OpenAiEvaluator` or `HeuristicEvaluator`.

## 5. Handling evaluation latency/failure

**What AI suggested:** A full message broker (retries, DLQ) “to do it properly.”

**What I accepted / rejected:** Rejected the broker for this prototype. Accepted store-first + async evaluation via `EvaluationQueue` and states `submitted → evaluating → completed|failed`, with retry from `failed`.

## 6. Cursor implementation: Prisma vs raw SQL

**What AI suggested during scaffolding:** Either raw `better-sqlite3` statements or Prisma.

**What I accepted / rejected:** Accepted **Prisma + SQLite** for a clear schema, seed script, and less hand-rolled SQL in a short build. Rejected introducing a second datastore or ORM abstraction layer on top.

## 7. Cursor implementation: OpenAI-only vs always-on heuristic

**What AI suggested:** Fail the attempt if `OPENAI_API_KEY` is missing.

**What I accepted / rejected:** Rejected hard failure. Accepted `createEvaluator()` with `EVALUATOR=auto|openai|heuristic` so demos and tests work without a key via `HeuristicEvaluator`, while production demos can set the key for richer feedback.
