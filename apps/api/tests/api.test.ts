import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { EvaluationQueue } from "../src/infrastructure/queue/EvaluationQueue.js";
import { PracticeService } from "../src/application/PracticeService.js";
import { HeuristicEvaluator } from "../src/infrastructure/evaluators/HeuristicEvaluator.js";
import { createApp } from "../src/http/app.js";
import { RUBRIC_CRITERIA } from "../src/domain/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "./test.db");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.EVALUATOR = "heuristic";

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

execSync("npx prisma db push --skip-generate", {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  stdio: "inherit",
});

const prisma = new PrismaClient();
const evaluator = new HeuristicEvaluator();
let service: PracticeService;
let app: ReturnType<typeof createApp>;

const design = {
  assumptions: "Multi-floor lot with size-based spots and duration pricing.",
  classes:
    "ParkingLot coordinates floors; Floor owns spots; Spot; Ticket; FeePolicy interface.",
  relationships:
    "EntryGate uses ParkingLot port; FeePolicy injected at exit for pricing.",
  tradeoffs:
    "Interface for fees instead of hard-coded switch to keep pricing extensible.",
  extension:
    "Add EvSpot and filter in allocator for electric vehicles without rewriting entry.",
};

describe("API practice flow", () => {
  beforeAll(async () => {
    await prisma.problem.create({
      data: {
        slug: "parking-lot",
        title: "Parking Lot System",
        statement: "Design a parking lot.",
        constraintsJson: JSON.stringify(["multiple floors"]),
        extensionPrompt: "Add EV charging spots for electric vehicles only.",
        rubricJson: JSON.stringify(RUBRIC_CRITERIA),
      },
    });

    const queue = new EvaluationQueue(async (attemptId) => {
      await service.runEvaluation(attemptId);
    });
    service = new PracticeService(prisma, evaluator, queue);
    app = createApp(service);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs submit → evaluate → history and rejects double submit", async () => {
    const agent = request.agent(app);

    const created = await agent
      .post("/api/attempts")
      .send({ problemSlug: "parking-lot" })
      .expect(201);

    const attemptId = created.body.attempt.id as string;

    await agent
      .post(`/api/attempts/${attemptId}/submit`)
      .send({ design })
      .expect(202);

    await agent
      .post(`/api/attempts/${attemptId}/submit`)
      .send({ design })
      .expect(409);

    let status = "submitted";
    for (let i = 0; i < 40 && status !== "completed" && status !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const current = await agent.get(`/api/attempts/${attemptId}`).expect(200);
      status = current.body.attempt.status;
      if (status === "completed") {
        expect(current.body.attempt.evaluation.findings.length).toBe(
          RUBRIC_CRITERIA.length,
        );
      }
    }
    expect(status).toBe("completed");

    const history = await agent.get("/api/history").expect(200);
    expect(
      history.body.history.some((h: { id: string }) => h.id === attemptId),
    ).toBe(true);
  });
});
