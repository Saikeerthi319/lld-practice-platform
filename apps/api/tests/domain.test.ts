import { describe, expect, it } from "vitest";
import {
  assertCanRetryEvaluation,
  assertCanSubmit,
  assertTransition,
  canTransition,
  DomainError,
  validateDesignForSubmit,
} from "../src/domain/attemptLifecycle.js";
import type { DesignArtifact } from "../src/domain/types.js";

const goodDesign: DesignArtifact = {
  assumptions: "Single building, three floors, mixed vehicle sizes supported.",
  classes:
    "ParkingLot manages floors; Floor holds spots; Spot knows size; Ticket tracks entry; FeeCalculator computes cost.",
  relationships:
    "ParkingLot -> Floor -> Spot; EntryGate depends on ParkingLot interface for allocation.",
  tradeoffs:
    "Chose size-based spots over vehicle-type spots to keep allocation simpler at the cost of some waste.",
  extension:
    "Add EvSpot subclass and a filter in allocator so EV-only spots are skipped for non-EV vehicles.",
};

describe("attempt lifecycle", () => {
  it("allows draft → submitted → evaluating → completed", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
    expect(canTransition("submitted", "evaluating")).toBe(true);
    expect(canTransition("evaluating", "completed")).toBe(true);
    expect(canTransition("evaluating", "failed")).toBe(true);
    expect(canTransition("failed", "evaluating")).toBe(true);
    expect(canTransition("completed", "draft")).toBe(false);
  });

  it("rejects double submit", () => {
    expect(() => assertCanSubmit("submitted")).toThrow(DomainError);
    expect(() => assertCanSubmit("completed")).toThrow(DomainError);
  });

  it("only allows retry from failed", () => {
    expect(() => assertCanRetryEvaluation("completed")).toThrow(DomainError);
    expect(() => assertCanRetryEvaluation("failed")).not.toThrow();
  });

  it("rejects illegal transitions", () => {
    expect(() => assertTransition("draft", "completed")).toThrow(DomainError);
  });
});

describe("design validation", () => {
  it("rejects empty sections", () => {
    const errors = validateDesignForSubmit({
      assumptions: "",
      classes: "",
      relationships: "",
      tradeoffs: "",
      extension: "",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("accepts a complete design", () => {
    expect(validateDesignForSubmit(goodDesign)).toEqual([]);
  });
});
