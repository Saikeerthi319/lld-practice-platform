import type { DesignArtifact, Finding, RubricCriterion } from "../../domain/types.js";
import type { EvaluateInput, Evaluator } from "../../domain/evaluator.js";
import { normalizeFindings } from "../../domain/evaluator.js";

function lengthScore(text: string): number {
  const len = text.trim().length;
  if (len < 40) return 1;
  if (len < 80) return 2;
  if (len < 160) return 3;
  if (len < 320) return 4;
  return 5;
}

function mentionsInterfaceOrAbstraction(text: string): boolean {
  return /interface|abstract|strategy|factory|port|adapter|polymorph/i.test(text);
}

function mentionsExtension(text: string, extensionPrompt: string): boolean {
  const keywords = extensionPrompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 5)
    .slice(0, 8);
  const hay = text.toLowerCase();
  const hits = keywords.filter((k) => hay.includes(k)).length;
  return hits >= 2 || /would add|extend|without rewriting|plug|new class/i.test(text);
}

function excerpt(text: string, max = 120): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= max) return cleaned || "(empty)";
  return `${cleaned.slice(0, max)}…`;
}

export class HeuristicEvaluator implements Evaluator {
  readonly name = "heuristic";

  async evaluate(input: EvaluateInput) {
    const { design, rubric, extensionPrompt } = input;
    const findings: Finding[] = rubric.map((criterion) =>
      this.scoreCriterion(criterion, design, extensionPrompt),
    );

    const avg =
      findings.reduce((sum, f) => sum + f.score, 0) / Math.max(findings.length, 1);

    return {
      evaluatorName: this.name,
      findings: normalizeFindings(findings, rubric),
      summary: `Heuristic evaluation (no LLM). Average score ${avg.toFixed(1)}/5. Expand responsibilities, interfaces, and the extension plan for stronger feedback.`,
      rawModelJson: null,
    };
  }

  private scoreCriterion(
    criterion: RubricCriterion,
    design: DesignArtifact,
    extensionPrompt: string,
  ): Finding {
    switch (criterion.id) {
      case "requirement_coverage": {
        const score = Math.min(
          5,
          Math.round(
            (lengthScore(design.assumptions) + lengthScore(design.classes)) / 2,
          ),
        );
        return {
          criterionId: criterion.id,
          score,
          evidence: excerpt(design.assumptions || design.classes),
          concern:
            score < 3
              ? "Assumptions/classes look too thin to cover the stated requirements."
              : "Heuristic check cannot verify full requirement coverage.",
          suggestion:
            "Map each requirement to a class or collaboration explicitly.",
          confidence: 0.45,
        };
      }
      case "responsibilities": {
        const classLines = design.classes
          .split(/\n|;/)
          .map((l) => l.trim())
          .filter(Boolean);
        const score =
          classLines.length >= 4
            ? 4
            : classLines.length >= 2
              ? 3
              : lengthScore(design.classes);
        return {
          criterionId: criterion.id,
          score,
          evidence: excerpt(design.classes),
          concern:
            classLines.length < 2
              ? "Few distinct classes/responsibilities were listed."
              : "Watch for god-objects concentrating unrelated duties.",
          suggestion:
            "Name each class with a single primary responsibility sentence.",
          confidence: 0.5,
        };
      }
      case "coupling_cohesion": {
        const score = mentionsInterfaceOrAbstraction(
          `${design.relationships} ${design.classes} ${design.tradeoffs}`,
        )
          ? 4
          : Math.max(2, lengthScore(design.relationships) - 1);
        return {
          criterionId: criterion.id,
          score,
          evidence: excerpt(design.relationships),
          concern: mentionsInterfaceOrAbstraction(design.relationships)
            ? "None noted by heuristic."
            : "Little mention of interfaces or dependency boundaries.",
          suggestion:
            "Describe who depends on whom and which collaborations go through interfaces.",
          confidence: 0.4,
        };
      }
      case "extensibility": {
        const ok = mentionsExtension(design.extension, extensionPrompt);
        const score = ok ? Math.max(3, lengthScore(design.extension)) : 2;
        return {
          criterionId: criterion.id,
          score,
          evidence: excerpt(design.extension),
          concern: ok
            ? "Heuristic only checks topical overlap with the extension prompt."
            : "Extension discussion may not address the stated change.",
          suggestion:
            "Name the classes you would add/change and what stays stable.",
          confidence: 0.45,
        };
      }
      case "explanation":
      default: {
        const score = Math.round(
          (lengthScore(design.tradeoffs) + lengthScore(design.assumptions)) / 2,
        );
        return {
          criterionId: criterion.id,
          score,
          evidence: excerpt(design.tradeoffs || design.assumptions),
          concern:
            score < 3
              ? "Trade-offs/assumptions are under-specified."
              : "None noted by heuristic.",
          suggestion: "State at least one alternative you rejected and why.",
          confidence: 0.5,
        };
      }
    }
  }
}
