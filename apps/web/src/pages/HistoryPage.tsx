import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type HistoryItem } from "../api";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const delta = Date.now() - then;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .history()
      .then((data) => setHistory(data.history))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page-enter">
      <header className="page-intro">
        <h1>Attempt history</h1>
        <p className="lede">
          Reopen past feedback and compare how your designs improve across tries.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="history-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="history-row skeleton-block" style={{ display: "block" }}>
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      )}

      {!loading && history.length === 0 && !error && (
        <div className="empty-state">
          <h2>No attempts yet</h2>
          <p>Start with a problem and your history will show up here.</p>
          <Link className="button primary" to="/">
            Browse problems
          </Link>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div className="history-list">
          {history.map((item) => (
            <article key={item.id} className="history-row">
              <div>
                <h3>{item.problem.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {relativeTime(item.createdAt)} ·{" "}
                  <span className={`chip status-${item.status}`}>{item.status}</span>
                  {item.evaluation?.evaluatorName
                    ? ` · ${item.evaluation.evaluatorName}`
                    : null}
                </p>
                {item.evaluation?.summary && (
                  <p className="history-summary">{item.evaluation.summary}</p>
                )}
              </div>
              <Link className="button" to={`/attempts/${item.id}`}>
                Open
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
