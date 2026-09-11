import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ProblemSummary } from "../api";

const TAGS: Record<string, string[]> = {
  elevator: ["Concurrency", "Scheduling"],
  "parking-lot": ["Allocation", "Fees"],
  "vending-machine": ["State", "Inventory"],
  splitwise: ["Balances", "Groups"],
};

function excerpt(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 70 ? lastSpace : max)}…`;
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listProblems()
      .then((data) => setProblems(data.problems))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-enter problems-page">
      <header className="hero-block">
        <p className="eyebrow">LLD Practice Platform</p>
        <h1>Design with feedback, not guesswork</h1>
        <p className="lede">
          Work through classic low-level design prompts, submit a structured
          solution, and get rubric feedback tied to your own writing.
        </p>
        <ol className="loop-steps">
          <li>
            <span className="step-num">1</span>
            Choose
          </li>
          <li>
            <span className="step-num">2</span>
            Design
          </li>
          <li>
            <span className="step-num">3</span>
            Submit
          </li>
          <li>
            <span className="step-num">4</span>
            Improve
          </li>
        </ol>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="section-label">
        <h2>Problems</h2>
        <span className="muted">{loading ? "…" : `${problems.length} available`}</span>
      </div>

      {loading && (
        <div className="grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="problem-tile skeleton-block">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid">
          {problems.map((problem, index) => (
            <article key={problem.id} className="problem-tile">
              <div className="tile-top">
                <span className="tile-index">0{index + 1}</span>
                <div className="tag-row">
                  {(TAGS[problem.slug] ?? ["LLD"]).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <h2>{problem.title}</h2>
              <p className="problem-excerpt">{excerpt(problem.statement)}</p>
              <div className="meta-row">
                <span className="meta">Text design · Rubric feedback</span>
                <Link className="button primary" to={`/problems/${problem.slug}`}>
                  Start
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
