import type { AttemptStatus, DesignArtifact } from "./types.js";
import { EMPTY_DESIGN } from "./types.js";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "CONFLICT" | "NOT_FOUND" | "ILLEGAL_STATE",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

const MIN_FIELD_LENGTH = 20;

export function parseDesignArtifact(raw: unknown): DesignArtifact {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_DESIGN };
  }
  const obj = raw as Record<string, unknown>;
  return {
    assumptions: String(obj.assumptions ?? ""),
    classes: String(obj.classes ?? ""),
    relationships: String(obj.relationships ?? ""),
    tradeoffs: String(obj.tradeoffs ?? ""),
    extension: String(obj.extension ?? ""),
  };
}

export function validateDesignForSubmit(design: DesignArtifact): string[] {
  const errors: string[] = [];
  const fields: Array<keyof DesignArtifact> = [
    "assumptions",
    "classes",
    "relationships",
    "tradeoffs",
    "extension",
  ];

  for (const field of fields) {
    const value = design[field].trim();
    if (!value) {
      errors.push(`Missing required section: ${field}`);
    } else if (value.length < MIN_FIELD_LENGTH) {
      errors.push(
        `Section "${field}" is too short (min ${MIN_FIELD_LENGTH} characters)`,
      );
    }
  }

  return errors;
}

export function assertCanSaveDraft(status: AttemptStatus): void {
  if (status !== "draft") {
    throw new DomainError(
      `Cannot save draft while attempt is ${status}`,
      "ILLEGAL_STATE",
    );
  }
}

export function assertCanSubmit(status: AttemptStatus): void {
  if (status !== "draft") {
    throw new DomainError(
      status === "submitted" || status === "evaluating" || status === "completed"
        ? "Attempt already submitted"
        : `Cannot submit while attempt is ${status}`,
      "CONFLICT",
    );
  }
}

export function assertCanRetryEvaluation(status: AttemptStatus): void {
  if (status !== "failed") {
    throw new DomainError(
      "Retry evaluation is only allowed when status is failed",
      "ILLEGAL_STATE",
    );
  }
}

export function nextStatusAfterSubmit(): AttemptStatus {
  return "submitted";
}

export function canTransition(
  from: AttemptStatus,
  to: AttemptStatus,
): boolean {
  const allowed: Record<AttemptStatus, AttemptStatus[]> = {
    draft: ["submitted"],
    submitted: ["evaluating"],
    evaluating: ["completed", "failed"],
    completed: [],
    failed: ["evaluating"],
  };
  return allowed[from].includes(to);
}

export function assertTransition(
  from: AttemptStatus,
  to: AttemptStatus,
): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      `Illegal transition ${from} → ${to}`,
      "ILLEGAL_STATE",
    );
  }
}
