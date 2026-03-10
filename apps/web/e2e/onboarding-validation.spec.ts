import { expect, test } from "@playwright/test";
import { assertEmailContains } from "./utils/mail-client";
import {
  captureCheckpoint,
  createCaseViaUi,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("reject then resubmit document flow works", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Reject",
    supplierVat: createUniqueVat("REJECT"),
    supplierContactName: "Reject Tester",
    supplierContactEmail: "reject@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, "reject@example.com");

  const finRow = page.locator("tr").filter({ has: page.getByText(/^FIN-01$/) }).first();
  await finRow.locator('select[name="decision"]').selectOption("reject");
  await finRow.getByRole("button", { name: "Apply" }).click();

  await expect(page.locator('[data-label-for="response_in_progress"]').first()).toBeVisible();
  await assertEmailContains(request, "reject@example.com", "correction required", "were rejected");
  await captureCheckpoint(page, testInfo, "01-document-rejected");

  await page.goto(supplierUrl);
  await expect(page.getByText(/documents were rejected|documentos fueron rechazados/i)).toBeVisible();
  const rejectedRequirement = page.locator("aside section").filter({ has: page.getByText(/FIN-01/) }).first();
  let uploadInput = rejectedRequirement.locator('input[type="file"]');
  if ((await uploadInput.count()) === 0) {
    await rejectedRequirement.locator("button").first().click();
    uploadInput = rejectedRequirement.locator('input[type="file"]');
  }
  await uploadInput.setInputFiles([
    {
      name: "fin-01-correction.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 correction")
    }
  ]);
  await expect(rejectedRequirement.getByRole("link", { name: "fin-01-correction.pdf" })).toBeVisible();
  await page.getByRole("button", { name: /Submit Response|Enviar respuesta/i }).click();
  await expect(page.getByTestId("supplier-submitted-card")).toBeVisible();

  await page.goto(`/cases/${caseId}`);
  const reopenedFinRow = page.locator("tr").filter({ has: page.getByText(/^FIN-01$/) }).first();
  await expect(reopenedFinRow.getByText(/pending validation|pendiente de validación/i)).toBeVisible();
  await captureCheckpoint(page, testInfo, "02-document-resubmitted");
});

test("approve provisionally decision is persisted", async ({ page, request }, testInfo) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Provisional",
    supplierVat: createUniqueVat("PROVISIONAL"),
    supplierContactName: "Provisional Tester",
    supplierContactEmail: "provisional@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, "provisional@example.com");

  const finRow = page.locator("tr").filter({ has: page.getByText(/^FIN-01$/) }).first();
  await finRow.locator('select[name="decision"]').selectOption("approve_provisionally");
  await finRow.getByRole("button", { name: "Apply" }).click();

  await expect(finRow.getByText(/approved provisionally/i)).toBeVisible();
  await captureCheckpoint(page, testInfo, "provisional-approved");
});
