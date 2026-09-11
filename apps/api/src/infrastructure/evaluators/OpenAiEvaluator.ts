import OpenAI from "openai";
import type { EvaluateInput, Evaluator } from "../../domain/evaluator.js";
import { normalizeFindings } from "../../domain/evaluator.js";
import type { Finding } from "../../domain/types.js";

export class OpenAiEvaluator implements Evaluator {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async evaluate(input: EvaluateInput) {
    const system = `You are an LLD design coach. Multiple valid designs exist — never treat a single reference class list as the only correct answer.
Score ONLY against the provided rubric criteria.
Return STRICT JSON with this shape:
{
  "summary": string,
  "findings": [
    {
      "criterionId": string,
      "score": number (1-5),
      "evidence": string (quote or paraphrase the learner's text),
      "concern": string,
      "suggestion": string,
      "confidence": number (0-1)
    }
  ]
}
Every rubric criterionId MUST appear exactly once. Evidence MUST reference the learner submission.`;

    const user = JSON.stringify(
      {
        problem: {
          title: input.problemTitle,
          statement: input.problemStatement,
          constraints: input.constraints,
          extensionPrompt: input.extensionPrompt,
        },
        rubric: input.rubric,
        submission: input.design,
      },
      null,
      2,
    );

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { summary?: string; findings?: Finding[] };
    try {
      parsed = JSON.parse(raw) as { summary?: string; findings?: Finding[] };
    } catch {
      throw new Error("OpenAI returned non-JSON content");
    }

    const findings = normalizeFindings(parsed.findings ?? [], input.rubric);

    return {
      evaluatorName: this.name,
      findings,
      summary:
        parsed.summary?.trim() ||
        "Structured rubric evaluation completed.",
      rawModelJson: raw,
    };
  }
}
