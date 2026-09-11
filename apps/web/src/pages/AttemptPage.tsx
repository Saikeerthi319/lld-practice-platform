import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Attempt } from "../api";

export default function AttemptPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function load() {
      try {
        const { attempt: next } = await api.getAttempt(id);
        if (cancelled) return;
        setAttempt(next);
        if (
          next.status === "submitted" ||
          next.status === "evaluating" ||
          next.evaluation?.status === "pending" ||
          next.evaluation?.status === "running"
        ) {
          timer = window.setTimeout(load, 2000);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const { attempt: next } = await api.retryEvaluation(id);
      setAttempt(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function tryAgain() {
    if (!attempt) return;
    navigate(`/problems/${attempt.problem.slug}?fresh=${Date.now()}`);
  }

  if (!attempt && !error) {
    return (
      <section className="page-enter skeleton-block">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    );
  }
  if (error && !attempt) return <p className="error">{error}</p>;
  if (!attempt) return null;

  const findings = attempt.evaluation?.findings ?? [];
  const rubricName = new Map(
    attempt.problem.rubric.map((r) => [r.id, r.name]),
  );
  const evaluating =
    attempt.status === "submitted" || attempt.status === "evaluating";
  const bannerClass =
    attempt.status === "completed"
      ? "status-banner completed"
      : attempt.status === "failed"
        ? "status-banner failed"
        : evaluating
          ? "status-banner evaluating"
          : "status-banner";

  return (
    <section className="page-enter">
      <div className="row-between" style={{ marginBottom: "1rem" }}>
        <div>
          <h1>{attempt.problem.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Attempt feedback
            {attempt.evaluation?.evaluatorName
              ? ` · ${attempt.evaluation.evaluatorName}`
              : ""}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="primary" disabled={busy} onClick={tryAgain}>
            Try again
          </button>
          <Link className="button" to="/history">
            History
          </Link>
        </div>
      </div>

      <div className={bannerClass}>
        <div>
          {evaluating && <span className="pulse-dot" aria-hidden />}
          <span className={`chip status-${attempt.status}`}>{attempt.status}</span>
          <span style={{ marginLeft: "0.65rem" }}>
            {evaluating && "Evaluating your design — this page updates automatically."}
            {attempt.status === "completed" && "Rubric feedback is ready."}
            {attempt.status === "failed" &&
              (attempt.evaluation?.errorMessage ||
                "Evaluation failed. You can retry without losing the submission.")}
            {attempt.status === "draft" && "Draft — not yet submitted."}
          </span>
        </div>
        {attempt.status === "failed" && (
          <button type="button" disabled={busy} onClick={() => void retry()}>
            Retry evaluation
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {attempt.evaluation?.summary && (
        <p className="summary-lead">{attempt.evaluation.summary}</p>
      )}

      {findings.length > 0 && (
        <>
          <h2>Rubric findings</h2>
          <div className="rubric-list">
            {findings.map((f) => (
              <article key={f.criterionId} className="finding-row">
                <div className="finding-top">
                  <h3 style={{ margin: 0 }}>
                    {rubricName.get(f.criterionId) ?? f.criterionId}
                  </h3>
                  <span className="score-pill">{f.score}/5</span>
                </div>
                <div className="finding-grid">
                  <div>
                    <div className="finding-label">Evidence</div>
                    <p>{f.evidence}</p>
                  </div>
                  <div>
                    <div className="finding-label">Concern</div>
                    <p>{f.concern}</p>
                  </div>
                  <div>
                    <div className="finding-label">Suggestion</div>
                    <p>{f.suggestion}</p>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                    Confidence {(f.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {attempt.submission && (
        <details className="submission-panel">
          <summary>Your submission</summary>
          {Object.entries(attempt.submission.payload).map(([key, value]) => (
            <div key={key} className="submission-section">
              <h4>{key}</h4>
              <p className="preline">{value}</p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
