import type { EvaluationResult, Finding, RubricCriterion } from "../domain/types.js";
import type { DesignArtifact } from "../domain/types.js";

export type EvaluateInput = {
  problemTitle: string;
  problemStatement: string;
  constraints: string[];
  extensionPrompt: string;
  rubric: RubricCriterion[];
  design: DesignArtifact;
};

export interface Evaluator {
  readonly name: string;
  evaluate(input: EvaluateInput): Promise<EvaluationResult>;
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 1;
  return Math.min(5, Math.max(1, Math.round(score)));
}

export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function normalizeFindings(
  findings: Finding[],
  rubric: RubricCriterion[],
): Finding[] {
  const byId = new Map(findings.map((f) => [f.criterionId, f]));
  return rubric.map((criterion) => {
    const existing = byId.get(criterion.id);
    if (!existing) {
      return {
        criterionId: criterion.id,
        score: 2,
        evidence: "No criterion-specific evidence was returned by the evaluator.",
        concern: "Missing structured finding for this criterion.",
        suggestion: "Re-run evaluation or expand the design explanation.",
        confidence: 0.3,
      };
    }
    return {
      criterionId: criterion.id,
      score: clampScore(existing.score),
      evidence: existing.evidence || "No evidence provided.",
      concern: existing.concern || "None noted.",
      suggestion: existing.suggestion || "None noted.",
      confidence: clampConfidence(existing.confidence),
    };
  });
}
