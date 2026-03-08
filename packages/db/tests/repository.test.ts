import { describe, expect, it } from "vitest";
import { getOnboardingRepository } from "../src/repository";

describe("onboarding repository", () => {
  it("creates a case and moves through invitation", async () => {
    const repository = getOnboardingRepository();

    const created = await repository.createCase({
      supplierName: "Proveedor A",
      supplierVat: `A-${crypto.randomUUID()}`,
      supplierContactName: "Alice",
      supplierContactEmail: "alice@example.com",
      requester: "Finance Team",
      categoryCode: "SUB-STD-NAT"
    });

    const invited = await repository.sendInvitation(created.id, "finance.user");

    expect(invited.status).toBe("invitation_sent");
    expect(invited.invitationToken).not.toBeNull();
    expect(created.sourceChannel).toBe("manual");
    expect(created.sourceReference).toBeNull();
  });

  it("supports idempotent lookup for SAP source references", async () => {
    const repository = getOnboardingRepository();

    const created = await repository.createCase(
      {
        supplierName: "Proveedor SAP",
        supplierVat: `SAP-${crypto.randomUUID()}`,
        supplierContactName: "Ana",
        supplierContactEmail: "ana@example.com",
        requester: "Ana Gomez",
        categoryCode: "SUB-STD-NAT"
      },
      "sap.integration:S4HANA-PRD",
      {
        sourceChannel: "sap_pr",
        sourceSystem: "S4HANA-PRD",
        sourceReference: "4500012345",
        requestedBySapUser: "U123456",
        sourceRequestedAt: "2026-03-06T10:30:00Z"
      }
    );

    const found = await repository.getCaseBySourceReference("sap_pr", "S4HANA-PRD", "4500012345");

    expect(found?.id).toBe(created.id);
    expect(found?.sourceChannel).toBe("sap_pr");
    expect(found?.requestedBySapUser).toBe("U123456");
  });
});
