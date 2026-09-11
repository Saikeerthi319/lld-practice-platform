# LLD Practice Platform

A focused prototype that lets a learner pick an LLD problem, write a structured text design, submit it, and receive rubric-based feedback (deterministic checks + AI or heuristic judgment), with full attempt history.

> See [`docs/RESEARCH.md`](docs/RESEARCH.md) and [`docs/DESIGN.md`](docs/DESIGN.md) for the *why*. Upload-ready copies live under [`docs/submission/`](docs/submission/).

## Practice loop

```
Choose problem → Write design → Submit → Evaluate → Review feedback → Try again
```

## Tech stack

- **API:** Node.js + Express + TypeScript
- **DB:** SQLite via Prisma
- **Web:** React + Vite + TypeScript
- **Evaluation:** in-process queue + `OpenAiEvaluator` or `HeuristicEvaluator`
- **Tests:** Vitest

## Project structure

```
apps/api/          Express, domain, Prisma, evaluators, queue
apps/web/          React practice UI
docs/              RESEARCH.md, DESIGN.md
docs/submission/   PDFs / combined upload files
README.md
AI_USAGE.md
.env.example
```

## How to run (development)

```bash
# From repo root
npm install
cp .env.example apps/api/.env
# Optional: set OPENAI_API_KEY in apps/api/.env (otherwise heuristic evaluator is used)
# EVALUATOR=auto|openai|heuristic

npm run db:setup
npm run dev:api
# In another terminal:
npm run dev:web
```

- API: http://localhost:4000 (`GET /api/health`)
- Web: http://localhost:5173 (proxies `/api` to the API)

## How to run (production-style single process)

```bash
npm install
npm run db:setup
npm run build
npm start
```

Express serves the Vite build and the API on http://localhost:4000.

## How to regenerate submission PDFs

```bash
npm run docs:pdf
```

Writes `docs/submission/Research_Note.pdf`, `Design_Note.pdf`, and `README_AND_AI_USAGE.pdf` (plus the combined `.md`).

## How to run tests

```bash
npm test
```

Coverage includes:

- Attempt state machine and design validation
- Heuristic evaluator fixtures (strong vs thin designs)
- API flow: create → submit → evaluate → history, plus double-submit 409

## Key decisions

1. **Structured text submission** behind a `Submission` / `text_v1` payload — enough evidence for LLD coaching; diagrams/code can be added later.
2. **Rubric findings**, not a single 0–100 score — each criterion has evidence, concern, suggestion, confidence.
3. **Deterministic validation before any evaluator** — missing sections fail fast without calling OpenAI.
4. **Persist then evaluate** — submission is stored before the async worker runs; failures do not lose work.
5. **`Evaluator` port** — `OpenAiEvaluator` and `HeuristicEvaluator` swap without changing the practice flow.

## Known limitations

- Cookie `learnerId` only — no real auth.
- In-process queue is not durable across server restart.
- Shared rubric across problems (not per-problem tuned).
- AI quality depends on the model/prompt; framed as coaching feedback, not a certified grade.

## What I'd build next

1. A second non-LLM rule evaluator to harden the port.
2. A `diagram_v1` submission format.
3. Per-problem rubric overrides.
4. Extract the evaluation worker when latency/load requires it.
