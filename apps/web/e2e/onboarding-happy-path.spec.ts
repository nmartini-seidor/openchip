import { expect, test } from "@playwright/test";
import { assertEmailContains } from "./utils/mail-client";
import {
  approveAllMandatory,
  captureCheckpoint,
  completeValidation,
  createCaseViaUi,
  createSupplierInSap,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("happy path reaches supplier_created_in_sap and records media", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const supplierEmail = "happy-path@example.com";
  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Happy",
    supplierVat: createUniqueVat("HAPPY"),
    supplierContactName: "Maria Happy",
    supplierContactEmail: supplierEmail,
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  await captureCheckpoint(page, testInfo, "01-case-created");

  const supplierUrl = await sendInvitationFromCase(page);
  await captureCheckpoint(page, testInfo, "02-invitation-sent");

  await assertEmailContains(request, supplierEmail, "onboarding invitation", "/supplier/");

  await submitSupplierResponse(page, supplierUrl, caseId);
  await captureCheckpoint(page, testInfo, "03-submission-completed");

  await approveAllMandatory(page);
  await completeValidation(page);
  await createSupplierInSap(page);

  await expect(page.locator("span").filter({ hasText: /^Supplier Created In Sap$/ }).first()).toBeVisible();

  await captureCheckpoint(page, testInfo, "04-sap-created");
});
