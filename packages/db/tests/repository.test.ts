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
  });
});
