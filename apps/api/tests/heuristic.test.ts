import { describe, expect, it } from "vitest";
import { HeuristicEvaluator } from "../src/infrastructure/evaluators/HeuristicEvaluator.js";
import { RUBRIC_CRITERIA } from "../src/domain/types.js";
import type { DesignArtifact } from "../src/domain/types.js";

const strong: DesignArtifact = {
  assumptions:
    "Multi-floor lot; spot sizes compact/large/motorcycle; fees by duration and type.",
  classes:
    "ParkingLot; Floor; ParkingSpot; Vehicle hierarchy; Ticket; PricingStrategy interface; EntryGate; ExitGate.",
  relationships:
    "Gates depend on ParkingLot port; PricingStrategy injected; Floor aggregates spots.",
  tradeoffs:
    "Strategy for pricing vs switch statements — chose strategy for extensibility.",
  extension:
    "Add ElectricVehicle and EvChargingSpot implementing Spot; allocator filters by capability without rewriting entry flow.",
};

const emptyish: DesignArtifact = {
  assumptions: "cars park somewhere in a lot somehow",
  classes: "ParkingLot does everything",
  relationships: "everything talks to ParkingLot",
  tradeoffs: "kept it simple",
  extension: "maybe add more spots later if needed somehow",
};

describe("HeuristicEvaluator", () => {
  const evaluator = new HeuristicEvaluator();

  it("scores a strong design higher than a thin god-class design", async () => {
    const strongResult = await evaluator.evaluate({
      problemTitle: "Parking Lot",
      problemStatement: "Design a parking lot",
      constraints: ["multiple floors"],
      extensionPrompt:
        "How would you add reserved EV charging spots that can only be used by electric vehicles?",
      rubric: [...RUBRIC_CRITERIA],
      design: strong,
    });
    const weakResult = await evaluator.evaluate({
      problemTitle: "Parking Lot",
      problemStatement: "Design a parking lot",
      constraints: ["multiple floors"],
      extensionPrompt:
        "How would you add reserved EV charging spots that can only be used by electric vehicles?",
      rubric: [...RUBRIC_CRITERIA],
      design: emptyish,
    });

    const avg = (findings: { score: number }[]) =>
      findings.reduce((s, f) => s + f.score, 0) / findings.length;

    expect(avg(strongResult.findings)).toBeGreaterThan(avg(weakResult.findings));
    expect(strongResult.evaluatorName).toBe("heuristic");
    expect(strongResult.findings).toHaveLength(RUBRIC_CRITERIA.length);
  });
});
