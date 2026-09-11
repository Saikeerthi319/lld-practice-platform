import { Router, type Request, type Response, type NextFunction } from "express";
import {
  DomainError,
  parseDesignArtifact,
} from "../domain/attemptLifecycle.js";
import type { PracticeService } from "../application/PracticeService.js";

const LEARNER_COOKIE = "learnerId";

export function createApiRouter(service: PracticeService): Router {
  const router = Router();

  async function withLearner(req: Request, res: Response): Promise<string> {
    const fromCookie = req.cookies?.[LEARNER_COOKIE] as string | undefined;
    const learnerId = await service.ensureLearner(fromCookie);
    if (fromCookie !== learnerId) {
      res.cookie(LEARNER_COOKIE, learnerId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });
    }
    return learnerId;
  }

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.get("/problems", async (_req, res, next) => {
    try {
      const problems = await service.listProblems();
      res.json({ problems });
    } catch (error) {
      next(error);
    }
  });

  router.get("/problems/:slug", async (req, res, next) => {
    try {
      const problem = await service.getProblem(req.params.slug);
      res.json({ problem });
    } catch (error) {
      next(error);
    }
  });

  router.post("/attempts", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const problemSlug = String(req.body?.problemSlug ?? "");
      if (!problemSlug) {
        throw new DomainError("problemSlug is required", "VALIDATION");
      }
      const created = await service.startAttempt(learnerId, problemSlug);
      const attempt = await service.getAttempt(created.id, learnerId);
      res.status(201).json({ attempt });
    } catch (error) {
      next(error);
    }
  });

  router.get("/attempts/:id", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const attempt = await service.getAttempt(req.params.id, learnerId);
      res.json({ attempt });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/attempts/:id", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const design = parseDesignArtifact(req.body?.design ?? req.body);
      const attempt = await service.saveDraft(req.params.id, learnerId, design);
      res.json({ attempt });
    } catch (error) {
      next(error);
    }
  });

  router.post("/attempts/:id/submit", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const design = req.body?.design
        ? parseDesignArtifact(req.body.design)
        : undefined;
      const attempt = await service.submit(req.params.id, learnerId, design);
      res.status(202).json({ attempt });
    } catch (error) {
      next(error);
    }
  });

  router.post("/attempts/:id/retry-evaluation", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const attempt = await service.retryEvaluation(req.params.id, learnerId);
      res.status(202).json({ attempt });
    } catch (error) {
      next(error);
    }
  });

  router.get("/history", async (req, res, next) => {
    try {
      const learnerId = await withLearner(req, res);
      const history = await service.listHistory(learnerId);
      res.json({ history });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "CONFLICT"
          ? 409
          : 400;
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type?: string }).type === "entity.parse.failed"
  ) {
    res.status(400).json({ error: "Invalid JSON body", code: "VALIDATION" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
