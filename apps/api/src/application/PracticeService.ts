import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  assertCanRetryEvaluation,
  assertCanSaveDraft,
  assertCanSubmit,
  assertTransition,
  DomainError,
  parseDesignArtifact,
  validateDesignForSubmit,
} from "../domain/attemptLifecycle.js";
import type { AttemptStatus, DesignArtifact, RubricCriterion } from "../domain/types.js";
import type { Evaluator } from "../domain/evaluator.js";
import type { EvaluationQueue } from "../infrastructure/queue/EvaluationQueue.js";

function asStatus(value: string): AttemptStatus {
  return value as AttemptStatus;
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseRubric(raw: string): RubricCriterion[] {
  try {
    const parsed = JSON.parse(raw) as RubricCriterion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class PracticeService {
  constructor(
    private readonly db: PrismaClient,
    private readonly evaluator: Evaluator,
    private readonly queue: EvaluationQueue,
  ) {}

  async ensureLearner(learnerId?: string | null) {
    const id = learnerId?.trim() || randomUUID();
    await this.db.learner.upsert({
      where: { id },
      update: {},
      create: { id },
    });
    return id;
  }

  listProblems() {
    return this.db.problem.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        statement: true,
      },
    });
  }

  async getProblem(slug: string) {
    const problem = await this.db.problem.findUnique({ where: { slug } });
    if (!problem) {
      throw new DomainError("Problem not found", "NOT_FOUND");
    }
    return {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      statement: problem.statement,
      constraints: parseJsonArray(problem.constraintsJson),
      extensionPrompt: problem.extensionPrompt,
      rubric: parseRubric(problem.rubricJson),
    };
  }

  async startAttempt(learnerId: string, problemSlug: string) {
    const problem = await this.db.problem.findUnique({
      where: { slug: problemSlug },
    });
    if (!problem) {
      throw new DomainError("Problem not found", "NOT_FOUND");
    }

    return this.db.attempt.create({
      data: {
        learnerId,
        problemId: problem.id,
        status: "draft",
        draftJson: JSON.stringify({
          assumptions: "",
          classes: "",
          relationships: "",
          tradeoffs: "",
          extension: "",
        }),
      },
      include: { problem: true, submission: true, evaluation: true },
    });
  }

  async getAttempt(attemptId: string, learnerId: string) {
    const attempt = await this.db.attempt.findUnique({
      where: { id: attemptId },
      include: { problem: true, submission: true, evaluation: true },
    });
    if (!attempt || attempt.learnerId !== learnerId) {
      throw new DomainError("Attempt not found", "NOT_FOUND");
    }
    return this.serializeAttempt(attempt);
  }

  async saveDraft(
    attemptId: string,
    learnerId: string,
    design: DesignArtifact,
  ) {
    const attempt = await this.db.attempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.learnerId !== learnerId) {
      throw new DomainError("Attempt not found", "NOT_FOUND");
    }
    assertCanSaveDraft(asStatus(attempt.status));

    const updated = await this.db.attempt.update({
      where: { id: attemptId },
      data: { draftJson: JSON.stringify(design) },
      include: { problem: true, submission: true, evaluation: true },
    });
    return this.serializeAttempt(updated);
  }

  async submit(attemptId: string, learnerId: string, design?: DesignArtifact) {
    const attempt = await this.db.attempt.findUnique({
      where: { id: attemptId },
      include: { problem: true, submission: true },
    });
    if (!attempt || attempt.learnerId !== learnerId) {
      throw new DomainError("Attempt not found", "NOT_FOUND");
    }
    assertCanSubmit(asStatus(attempt.status));

    const payload =
      design ?? parseDesignArtifact(JSON.parse(attempt.draftJson ?? "{}"));
    const errors = validateDesignForSubmit(payload);
    if (errors.length) {
      throw new DomainError(errors.join("; "), "VALIDATION");
    }

    assertTransition(asStatus(attempt.status), "submitted");

    const updated = await this.db.$transaction(async (tx) => {
      await tx.submission.create({
        data: {
          attemptId,
          format: "text_v1",
          payloadJson: JSON.stringify(payload),
        },
      });
      await tx.evaluation.create({
        data: {
          attemptId,
          status: "pending",
        },
      });
      return tx.attempt.update({
        where: { id: attemptId },
        data: {
          status: "submitted",
          submittedAt: new Date(),
          draftJson: JSON.stringify(payload),
        },
        include: { problem: true, submission: true, evaluation: true },
      });
    });

    this.queue.enqueue(attemptId);
    return this.serializeAttempt(updated);
  }

  async retryEvaluation(attemptId: string, learnerId: string) {
    const attempt = await this.db.attempt.findUnique({
      where: { id: attemptId },
      include: { problem: true, submission: true, evaluation: true },
    });
    if (!attempt || attempt.learnerId !== learnerId) {
      throw new DomainError("Attempt not found", "NOT_FOUND");
    }
    assertCanRetryEvaluation(asStatus(attempt.status));
    if (!attempt.submission) {
      throw new DomainError("Submission missing", "ILLEGAL_STATE");
    }

    await this.db.evaluation.update({
      where: { attemptId },
      data: {
        status: "pending",
        errorMessage: null,
        findingsJson: null,
        summary: null,
        rawModelJson: null,
        completedAt: null,
        evaluatorName: null,
      },
    });

    this.queue.enqueue(attemptId);
    const refreshed = await this.db.attempt.findUnique({
      where: { id: attemptId },
      include: { problem: true, submission: true, evaluation: true },
    });
    return this.serializeAttempt(refreshed!);
  }

  async listHistory(learnerId: string) {
    const attempts = await this.db.attempt.findMany({
      where: { learnerId },
      orderBy: { createdAt: "desc" },
      include: {
        problem: { select: { slug: true, title: true } },
        evaluation: { select: { status: true, summary: true, evaluatorName: true } },
      },
    });
    return attempts.map((a) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      submittedAt: a.submittedAt,
      problem: a.problem,
      evaluation: a.evaluation,
    }));
  }

  async runEvaluation(attemptId: string): Promise<void> {
    const attempt = await this.db.attempt.findUnique({
      where: { id: attemptId },
      include: { problem: true, submission: true, evaluation: true },
    });
    if (!attempt?.submission || !attempt.evaluation) {
      return;
    }

    const status = asStatus(attempt.status);
    if (status !== "submitted" && status !== "failed") {
      // Already evaluating/completed — ignore duplicate enqueue
      if (status === "evaluating" || status === "completed") return;
    }

    assertTransition(
      status === "failed" ? "failed" : "submitted",
      "evaluating",
    );

    await this.db.attempt.update({
      where: { id: attemptId },
      data: { status: "evaluating" },
    });
    await this.db.evaluation.update({
      where: { attemptId },
      data: { status: "running", errorMessage: null },
    });

    const design = parseDesignArtifact(
      JSON.parse(attempt.submission.payloadJson),
    );
    const rubric = parseRubric(attempt.problem.rubricJson);

    try {
      const result = await this.evaluator.evaluate({
        problemTitle: attempt.problem.title,
        problemStatement: attempt.problem.statement,
        constraints: parseJsonArray(attempt.problem.constraintsJson),
        extensionPrompt: attempt.problem.extensionPrompt,
        rubric,
        design,
      });

      assertTransition("evaluating", "completed");

      await this.db.$transaction([
        this.db.evaluation.update({
          where: { attemptId },
          data: {
            status: "completed",
            evaluatorName: result.evaluatorName,
            findingsJson: JSON.stringify(result.findings),
            summary: result.summary,
            rawModelJson: result.rawModelJson ?? null,
            errorMessage: null,
            completedAt: new Date(),
          },
        }),
        this.db.attempt.update({
          where: { id: attemptId },
          data: { status: "completed" },
        }),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Evaluation failed";
      assertTransition("evaluating", "failed");
      await this.db.$transaction([
        this.db.evaluation.update({
          where: { attemptId },
          data: {
            status: "failed",
            errorMessage: message,
            completedAt: new Date(),
          },
        }),
        this.db.attempt.update({
          where: { id: attemptId },
          data: { status: "failed" },
        }),
      ]);
    }
  }

  private serializeAttempt(
    attempt: {
      id: string;
      learnerId: string;
      status: string;
      draftJson: string | null;
      createdAt: Date;
      updatedAt: Date;
      submittedAt: Date | null;
      problem: {
        id: string;
        slug: string;
        title: string;
        statement: string;
        constraintsJson: string;
        extensionPrompt: string;
        rubricJson: string;
      };
      submission: { id: string; format: string; payloadJson: string; createdAt: Date } | null;
      evaluation: {
        id: string;
        status: string;
        evaluatorName: string | null;
        findingsJson: string | null;
        summary: string | null;
        errorMessage: string | null;
        completedAt: Date | null;
      } | null;
    },
  ) {
    return {
      id: attempt.id,
      status: attempt.status,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
      submittedAt: attempt.submittedAt,
      draft: parseDesignArtifact(
        attempt.draftJson ? JSON.parse(attempt.draftJson) : {},
      ),
      problem: {
        id: attempt.problem.id,
        slug: attempt.problem.slug,
        title: attempt.problem.title,
        statement: attempt.problem.statement,
        constraints: parseJsonArray(attempt.problem.constraintsJson),
        extensionPrompt: attempt.problem.extensionPrompt,
        rubric: parseRubric(attempt.problem.rubricJson),
      },
      submission: attempt.submission
        ? {
            id: attempt.submission.id,
            format: attempt.submission.format,
            payload: parseDesignArtifact(
              JSON.parse(attempt.submission.payloadJson),
            ),
            createdAt: attempt.submission.createdAt,
          }
        : null,
      evaluation: attempt.evaluation
        ? {
            id: attempt.evaluation.id,
            status: attempt.evaluation.status,
            evaluatorName: attempt.evaluation.evaluatorName,
            findings: attempt.evaluation.findingsJson
              ? JSON.parse(attempt.evaluation.findingsJson)
              : null,
            summary: attempt.evaluation.summary,
            errorMessage: attempt.evaluation.errorMessage,
            completedAt: attempt.evaluation.completedAt,
          }
        : null,
    };
  }
}
