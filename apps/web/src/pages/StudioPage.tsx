import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type DesignArtifact } from "../api";

const MIN_LEN = 20;

const empty: DesignArtifact = {
  assumptions: "",
  classes: "",
  relationships: "",
  tradeoffs: "",
  extension: "",
};

const FIELDS = [
  {
    key: "assumptions" as const,
    label: "Assumptions",
    help: "What are you taking as given? Scope, scale, and non-goals.",
    rows: 4,
  },
  {
    key: "classes" as const,
    label: "Classes & responsibilities",
    help: "Name each class with one primary responsibility sentence.",
    rows: 6,
  },
  {
    key: "relationships" as const,
    label: "Relationships / collaboration",
    help: "Who depends on whom? Call out interfaces or ports.",
    rows: 4,
  },
  {
    key: "tradeoffs" as const,
    label: "Trade-offs",
    help: "State at least one alternative you rejected and why.",
    rows: 4,
  },
  {
    key: "extension" as const,
    label: "Extension plan",
    help: "How would the design absorb the extension prompt without a rewrite?",
    rows: 4,
  },
];

export default function StudioPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const fresh = searchParams.get("fresh") ?? "";
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [constraints, setConstraints] = useState<string[]>([]);
  const [extensionPrompt, setExtensionPrompt] = useState("");
  const [design, setDesign] = useState<DesignArtifact>(empty);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { attempt } = await api.startAttempt(slug);
        if (cancelled) return;
        setAttemptId(attempt.id);
        setTitle(attempt.problem.title);
        setStatement(attempt.problem.statement);
        setConstraints(attempt.problem.constraints);
        setExtensionPrompt(attempt.problem.extensionPrompt);
        setDesign(attempt.draft);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, fresh]);

  const ready = useMemo(() => {
    return FIELDS.every((f) => design[f.key].trim().length >= MIN_LEN);
  }, [design]);

  function updateField(field: keyof DesignArtifact, value: string) {
    setDesign((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  }

  async function saveDraft(quiet = false) {
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveDraft(attemptId, design);
      if (!quiet) setMessage("Draft saved.");
      else setMessage("Saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onBlurSave() {
    if (!attemptId || busy) return;
    try {
      await api.saveDraft(attemptId, design);
      setMessage("Saved");
    } catch {
      // keep typing; manual save still available
    }
  }

  async function submit() {
    if (!attemptId) return;
    if (!ready) {
      setError(
        `Fill every section with at least ${MIN_LEN} characters before submitting.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submit(attemptId, design);
      navigate(`/attempts/${attemptId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="studio page-enter">
        <div className="studio-brief skeleton-block">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
        <div className="studio-editor skeleton-block">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </section>
    );
  }

  return (
    <section className="studio page-enter">
      <aside className="studio-brief">
        <div className="brief-block">
          <h1>{title || "Problem"}</h1>
          <p className="preline muted">{statement}</p>
        </div>
        <div>
          <h3>Constraints</h3>
          <ul className="constraint-list">
            {constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="extension-callout">
          <div className="label">Extension prompt</div>
          <p style={{ margin: 0 }}>{extensionPrompt}</p>
        </div>
      </aside>

      <div className="studio-editor">
        <h2>Your design</h2>
        {FIELDS.map((field) => {
          const len = design[field.key].trim().length;
          const countClass =
            len >= MIN_LEN ? "char-count ok-count" : "char-count short";
          return (
            <label key={field.key} className="field">
              <div className="field-head">
                <span className="field-label">{field.label}</span>
                <span className={countClass}>
                  {len}/{MIN_LEN}
                </span>
              </div>
              <p className="field-help">{field.help}</p>
              <textarea
                value={design[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                onBlur={() => void onBlurSave()}
                rows={field.rows}
                placeholder={`Write your ${field.label.toLowerCase()}…`}
              />
            </label>
          );
        })}
        {error && <p className="error">{error}</p>}
      </div>

      <footer className="studio-footer">
        <div>
          {message ? (
            <span className="toast">{message}</span>
          ) : (
            <span className="hint">
              {ready
                ? "Ready to submit for rubric feedback."
                : `Complete all sections (${MIN_LEN}+ chars each). Draft autosaves on blur.`}
            </span>
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            disabled={busy || !attemptId}
            onClick={() => void saveDraft(false)}
          >
            Save draft
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy || !attemptId || !ready}
            onClick={() => void submit()}
          >
            Submit for feedback
          </button>
        </div>
      </footer>
    </section>
  );
}
