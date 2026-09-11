export type DesignArtifact = {
  assumptions: string;
  classes: string;
  relationships: string;
  tradeoffs: string;
  extension: string;
};

export type Finding = {
  criterionId: string;
  score: number;
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number;
};

export type ProblemSummary = {
  id: string;
  slug: string;
  title: string;
  statement: string;
};

export type Attempt = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  draft: DesignArtifact;
  problem: {
    id: string;
    slug: string;
    title: string;
    statement: string;
    constraints: string[];
    extensionPrompt: string;
    rubric: { id: string; name: string; description: string }[];
  };
  submission: {
    id: string;
    format: string;
    payload: DesignArtifact;
    createdAt: string;
  } | null;
  evaluation: {
    id: string;
    status: string;
    evaluatorName: string | null;
    findings: Finding[] | null;
    summary: string | null;
    errorMessage: string | null;
    completedAt: string | null;
  } | null;
};

export type HistoryItem = {
  id: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  problem: { slug: string; title: string };
  evaluation: {
    status: string;
    summary: string | null;
    evaluatorName: string | null;
  } | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listProblems: () => request<{ problems: ProblemSummary[] }>("/api/problems"),
  getProblem: (slug: string) =>
    request<{ problem: Attempt["problem"] }>(`/api/problems/${slug}`),
  startAttempt: (problemSlug: string) =>
    request<{ attempt: Attempt }>("/api/attempts", {
      method: "POST",
      body: JSON.stringify({ problemSlug }),
    }),
  getAttempt: (id: string) =>
    request<{ attempt: Attempt }>(`/api/attempts/${id}`),
  saveDraft: (id: string, design: DesignArtifact) =>
    request<{ attempt: Attempt }>(`/api/attempts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ design }),
    }),
  submit: (id: string, design: DesignArtifact) =>
    request<{ attempt: Attempt }>(`/api/attempts/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ design }),
    }),
  retryEvaluation: (id: string) =>
    request<{ attempt: Attempt }>(`/api/attempts/${id}/retry-evaluation`, {
      method: "POST",
    }),
  history: () => request<{ history: HistoryItem[] }>("/api/history"),
};
