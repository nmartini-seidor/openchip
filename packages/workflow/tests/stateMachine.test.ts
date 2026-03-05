import { describe, expect, it } from "vitest";
import { canTransition, transitionCaseStatus } from "../src/stateMachine";

describe("state machine", () => {
  it("allows the expected happy path transition", () => {
    expect(canTransition("onboarding_initiated", "invitation_sent")).toBe(true);
    expect(transitionCaseStatus("invitation_sent", "portal_accessed")).toBe("portal_accessed");
  });

  it("rejects invalid transitions", () => {
    expect(() => transitionCaseStatus("onboarding_initiated", "supplier_created_in_sap")).toThrowError(
      "Invalid status transition"
    );
  });
});
