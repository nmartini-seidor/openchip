import { describe, expect, it } from "vitest";
import { evaluateCompliance } from "../src/compliance";
import { DocumentSubmission } from "@openchip/shared";

const baseDocument: DocumentSubmission = {
  code: "FIN-01",
  requirementLevel: "mandatory",
  status: "pending_validation",
  version: 1,
  uploadedAt: new Date().toISOString(),
  files: [],
  approver: null,
  validationDate: null,
  validFrom: null,
  validTo: null,
  comments: null
};

describe("compliance", () => {
  it("blocks when mandatory blocking documents are not approved", () => {
    const result = evaluateCompliance([baseDocument]);
    expect(result.blocked).toBe(true);
    expect(result.mandatoryPendingCount).toBe(1);
  });

  it("does not block when mandatory blocking document is approved and valid", () => {
    const result = evaluateCompliance([
      {
        ...baseDocument,
        status: "approved",
        validTo: new Date(Date.now() + 86_400_000).toISOString()
      }
    ]);
    expect(result.blocked).toBe(false);
  });
});
