import type { Evaluator } from "../../domain/evaluator.js";
import { HeuristicEvaluator } from "./HeuristicEvaluator.js";
import { OpenAiEvaluator } from "./OpenAiEvaluator.js";

export function createEvaluator(): Evaluator {
  const mode = (process.env.EVALUATOR ?? "auto").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (mode === "heuristic") {
    return new HeuristicEvaluator();
  }

  if (mode === "openai") {
    if (!apiKey) {
      console.warn("EVALUATOR=openai but OPENAI_API_KEY missing; using heuristic.");
      return new HeuristicEvaluator();
    }
    return new OpenAiEvaluator(apiKey, process.env.OPENAI_MODEL || "gpt-4o-mini");
  }

  // auto
  if (apiKey) {
    return new OpenAiEvaluator(apiKey, process.env.OPENAI_MODEL || "gpt-4o-mini");
  }
  console.warn("No OPENAI_API_KEY; using HeuristicEvaluator.");
  return new HeuristicEvaluator();
}
