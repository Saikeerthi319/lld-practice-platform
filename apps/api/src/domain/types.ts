export const RUBRIC_CRITERIA = [
  {
    id: "requirement_coverage",
    name: "Requirement coverage",
    description:
      "Does the design address the stated requirements and constraints without inventing conflicting ones?",
  },
  {
    id: "responsibilities",
    name: "Class responsibilities",
    description:
      "Are responsibilities clear, cohesive, and owned by the right abstractions?",
  },
  {
    id: "coupling_cohesion",
    name: "Coupling and cohesion",
    description:
      "Is collaboration intentional, with limited coupling and sensible interfaces?",
  },
  {
    id: "extensibility",
    name: "Extensibility",
    description:
      "Would the design absorb the stated requirement change without a rewrite?",
  },
  {
    id: "explanation",
    name: "Quality of explanation",
    description:
      "Are assumptions and trade-offs explicit and grounded in the design?",
  },
] as const;

export type CriterionId = (typeof RUBRIC_CRITERIA)[number]["id"];

export type DesignArtifact = {
  assumptions: string;
  classes: string;
  relationships: string;
  tradeoffs: string;
  extension: string;
};

export type RubricCriterion = {
  id: string;
  name: string;
  description: string;
};

export type Finding = {
  criterionId: string;
  score: number;
  evidence: string;
  concern: string;
  suggestion: string;
  confidence: number;
};

export type EvaluationResult = {
  evaluatorName: string;
  findings: Finding[];
  summary: string;
  rawModelJson?: string | null;
};

export const ATTEMPT_STATUSES = [
  "draft",
  "submitted",
  "evaluating",
  "completed",
  "failed",
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const EMPTY_DESIGN: DesignArtifact = {
  assumptions: "",
  classes: "",
  relationships: "",
  tradeoffs: "",
  extension: "",
};
