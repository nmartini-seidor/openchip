import { describe, expect, it } from "vitest";
import { getRequirementLevel, getRequirementMatrixCount, resolveRequirementsForCategory } from "../src/requirements";

describe("requirement matrix", () => {
  it("builds the 97-row requirement matrix", () => {
    expect(getRequirementMatrixCount()).toBe(97);
  });

  it("marks FIN-01 as mandatory for all categories", () => {
    const rows = resolveRequirementsForCategory("SUB-STD-NAT");
    const fin01 = rows.find((row) => row.documentCode === "FIN-01");
    expect(fin01?.requirementLevel).toBe("mandatory");
  });

  it("requires TAX-02 for non-subsidized subcontractor national", () => {
    expect(getRequirementLevel("NSUB-SC-NAT", "TAX-02")).toBe("mandatory");
  });

  it("sets SUB-01 as non-applicable for non-subsidized categories", () => {
    expect(getRequirementLevel("NSUB-STD-NAT", "SUB-01")).toBe("not_applicable");
  });
});
