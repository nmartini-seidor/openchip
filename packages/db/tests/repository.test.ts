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

  it("updates supplier information and records audit action", async () => {
    const repository = getOnboardingRepository();

    const created = await repository.createCase({
      supplierName: "Proveedor Editable",
      supplierVat: `EDIT-${crypto.randomUUID()}`,
      supplierContactName: "Edit User",
      supplierContactEmail: "edit@example.com",
      requester: "Finance Team",
      categoryCode: "SUB-STD-NAT"
    });

    const updated = await repository.updateSupplierInfo(
      {
        caseId: created.id,
        supplierName: "Proveedor Editable Updated",
        supplierVat: created.supplierVat,
        supplierContactName: "Edit User Updated",
        supplierContactEmail: "edit-updated@example.com"
      },
      "Finance User <finance@openchip.local>"
    );

    expect(updated.supplierName).toBe("Proveedor Editable Updated");
    expect(updated.supplierContactName).toBe("Edit User Updated");
    expect(updated.supplierContactEmail).toBe("edit-updated@example.com");
    expect(updated.actionHistory.at(-1)?.actionType).toBe("supplier_info_updated");
  });

  it("rejects supplier info update when VAT duplicates another active case", async () => {
    const repository = getOnboardingRepository();

    const first = await repository.createCase({
      supplierName: "Proveedor First",
      supplierVat: `VATA-${crypto.randomUUID()}`,
      supplierContactName: "First User",
      supplierContactEmail: "first@example.com",
      requester: "Finance Team",
      categoryCode: "SUB-STD-NAT"
    });

    const second = await repository.createCase({
      supplierName: "Proveedor Second",
      supplierVat: `VATB-${crypto.randomUUID()}`,
      supplierContactName: "Second User",
      supplierContactEmail: "second@example.com",
      requester: "Finance Team",
      categoryCode: "SUB-STD-NAT"
    });

    await expect(
      repository.updateSupplierInfo(
        {
          caseId: second.id,
          supplierName: second.supplierName,
          supplierVat: first.supplierVat,
          supplierContactName: second.supplierContactName,
          supplierContactEmail: second.supplierContactEmail
        },
        "Finance User <finance@openchip.local>"
      )
    ).rejects.toThrow(/same VAT/i);
  });

  it("reopens supplier response on rejected document and preserves approved validations on resubmission", async () => {
    const repository = getOnboardingRepository();

    const created = await repository.createCase({
      supplierName: "Proveedor Rework",
      supplierVat: `REWORK-${crypto.randomUUID()}`,
      supplierContactName: "Rework User",
      supplierContactEmail: "rework@example.com",
      requester: "Finance Team",
      categoryCode: "SUB-STD-NAT"
    });
    const invited = await repository.sendInvitation(created.id, "finance.user");
    const invitationToken = invited.invitationToken;
    if (invitationToken === null) {
      throw new Error("Missing invitation token");
    }

    const requirements = (await repository.getRequirementPreview(created.categoryCode)).filter(
      (row) => row.requirementLevel === "mandatory" || row.requirementLevel === "optional"
    );
    expect(requirements.length).toBeGreaterThanOrEqual(2);

    const createFile = (name: string) => ({
      id: crypto.randomUUID(),
      fileName: name,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storagePath: `/mock/${name}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "supplier.portal"
    });

    await repository.submitSupplierResponse(
      {
        token: invitationToken,
        supplierIdentity: {
          supplierName: created.supplierName,
          supplierVat: created.supplierVat,
          supplierContactName: created.supplierContactName
        },
        identityConfirmed: true,
        address: {
          street: "Street 1",
          city: "Barcelona",
          postalCode: "08001",
          country: "ES"
        },
        bankAccount: {
          bkvid: "0001",
          banks: "ES",
          bankl: "",
          bankn: "12345678",
          bkont: null,
          accname: "Proveedor Rework SL",
          bkValidFrom: "",
          bkValidTo: "",
          iban: null
        },
        uploadedDocuments: requirements.map((row, index) => ({
          code: row.code,
          files: [createFile(`initial-${row.code.toLowerCase()}-${index + 1}.pdf`)]
        }))
      },
      "supplier.portal"
    );

    const rejectedCode = requirements[0]?.code;
    const approvedCode = requirements[1]?.code;
    if (rejectedCode === undefined || approvedCode === undefined) {
      throw new Error("Expected at least 2 requirement codes");
    }

    await repository.validateDocument({
      caseId: created.id,
      code: approvedCode,
      decision: "approve",
      approver: "compliance.user",
      comments: "Approved"
    });
    const reopened = await repository.validateDocument({
      caseId: created.id,
      code: rejectedCode,
      decision: "reject",
      approver: "compliance.user",
      comments: "Rejected for correction"
    });

    expect(reopened.status).toBe("response_in_progress");
    expect(reopened.documents.find((document) => document.code === rejectedCode)?.status).toBe("rejected");
    expect(reopened.actionHistory.some((entry) => entry.actionType === "supplier_rework_requested")).toBe(false);

    await repository.upsertSupplierDraftDocuments(
      invitationToken,
      [
        {
          code: rejectedCode,
          files: [createFile(`rework-${rejectedCode.toLowerCase()}.pdf`)]
        }
      ],
      "supplier.portal"
    );

    const resubmitted = await repository.submitSupplierResponse(
      {
        token: invitationToken,
        supplierIdentity: {
          supplierName: created.supplierName,
          supplierVat: created.supplierVat,
          supplierContactName: created.supplierContactName
        },
        identityConfirmed: true,
        address: {
          street: "Street 1",
          city: "Barcelona",
          postalCode: "08001",
          country: "ES"
        },
        bankAccount: {
          bkvid: "0001",
          banks: "ES",
          bankl: "",
          bankn: "12345678",
          bkont: null,
          accname: "Proveedor Rework SL",
          bkValidFrom: "",
          bkValidTo: "",
          iban: null
        },
        uploadedDocuments: []
      },
      "supplier.portal"
    );

    expect(resubmitted.status).toBe("submission_completed");
    expect(resubmitted.documents.find((document) => document.code === approvedCode)?.status).toBe("approved");
    expect(resubmitted.documents.find((document) => document.code === rejectedCode)?.status).toBe("pending_validation");
  });
});
