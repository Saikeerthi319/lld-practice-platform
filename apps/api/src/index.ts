import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "./infrastructure/db/prisma.js";
import { createEvaluator } from "./infrastructure/evaluators/createEvaluator.js";
import { EvaluationQueue } from "./infrastructure/queue/EvaluationQueue.js";
import { PracticeService } from "./application/PracticeService.js";
import { createApp } from "./http/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../prisma/dev.db")}`;
}

const evaluator = createEvaluator();
const queue = new EvaluationQueue(async (attemptId) => {
  await service.runEvaluation(attemptId);
});
const service = new PracticeService(prisma, evaluator, queue);
const app = createApp(service);

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`LLD Practice API listening on http://localhost:${port}`);
  console.log(`Evaluator: ${evaluator.name}`);
});
