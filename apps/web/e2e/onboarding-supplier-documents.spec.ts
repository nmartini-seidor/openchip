import { expect, test } from "@playwright/test";
import {
  createCaseViaUi,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase,
  submitSupplierResponse
} from "./utils/scenario";

test("supplier uploads are visible to internal users and expiry can be edited", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const caseId = await createCaseViaUi(page, {
    supplierName: "Proveedor Evidencias",
    supplierVat: createUniqueVat("FILES"),
    supplierContactName: "Evidence Contact",
    supplierContactEmail: "evidence@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await submitSupplierResponse(page, supplierUrl, caseId, "evidence@example.com");

  const fileLinks = page.locator('a[href*="/api/cases/"][href*="/files/"]');
  await expect(fileLinks.first()).toBeVisible();

  const validToInput = page.locator('input[name="validTo"]').first();
  await validToInput.fill("2027-05-31");
  await page.getByRole("button", { name: /Set expiry|Guardar fecha/ }).first().click();
  await expect(validToInput).toHaveValue("2027-05-31");
});
