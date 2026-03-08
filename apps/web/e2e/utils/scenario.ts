import { APIRequestContext, expect, Page, TestInfo } from "@playwright/test";

export interface NewCaseInput {
  supplierName: string;
  supplierVat: string;
  supplierContactName: string;
  supplierContactEmail: string;
  requester?: string;
  categoryCode: string;
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function createUniqueVat(prefix: string): string {
  const prefixPart = prefix.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4).padEnd(2, "X");
  const timePart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(10 + Math.random() * 90).toString();
  return `${prefixPart}${timePart}${randomPart}`;
}

export async function captureCheckpoint(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  await page.screenshot({
    path: testInfo.outputPath(`${safeName(label)}.png`),
    fullPage: true
  });
}

export async function resetTestState(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/test/reset");
  expect(response.ok()).toBeTruthy();
}

export async function loginAsFinance(page: Page): Promise<void> {
  await loginAs(page, "finance@openchip.local");
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin@openchip.local");
}

export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

export function extractCaseIdFromUrl(url: string): string {
  const match = url.match(/\/cases\/([^/?#]+)/);
  if (match === null || match[1] === undefined) {
    throw new Error(`Cannot extract caseId from URL: ${url}`);
  }

  return match[1];
}

export async function createCaseViaUi(page: Page, input: NewCaseInput): Promise<string> {
  await page.goto("/cases/new");

  await page.getByLabel("Supplier Name").fill(input.supplierName);
  await page.getByLabel("Supplier VAT / Tax ID").fill(input.supplierVat);
  await page.getByRole("button", { name: "Validate VAT" }).click();
  await page.getByLabel("Supplier Contact Name").fill(input.supplierContactName);
  await page.getByLabel("Supplier Contact Email").fill(input.supplierContactEmail);
  await page.getByLabel("Supplier Category").selectOption(input.categoryCode);
  await page.getByRole("button", { name: "Create onboarding case" }).click();

  await expect(page).toHaveURL(/\/cases\/[0-9a-fA-F-]{36}$/);
  return extractCaseIdFromUrl(page.url());
}

export async function sendInvitationFromCase(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Send invitation" }).click();
  const supplierLink = page.getByRole("link", { name: "Open supplier portal" });
  await expect(supplierLink).toBeVisible();

  const href = await supplierLink.getAttribute("href");
  if (href === null) {
    throw new Error("Missing supplier portal link after invitation.");
  }

  return href;
}

export async function submitSupplierResponse(page: Page, supplierUrl: string, caseId: string): Promise<void> {
  await page.goto(supplierUrl);
  await page.getByLabel(/Address|Dirección/).fill("Carrer de Mallorca 123");
  await page.getByLabel(/Country|País/).fill("Spain");
  await page.getByRole("button", { name: /Submit supplier response|Enviar respuesta/ }).click();

  await expect(page).toHaveURL(new RegExp(`/supplier/.+\?submitted=1$`));
  await page.goto(`/cases/${caseId}`);
  await expect(page).toHaveURL(new RegExp(`/cases/${caseId}$`));
}

export async function approveAllMandatory(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Approve all mandatory documents" }).click();
}

export async function completeValidation(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Complete validation" }).click();
}

export async function createSupplierInSap(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Create supplier in SAP" }).click();
}

export async function openCase(page: Page, caseId: string): Promise<void> {
  await page.goto(`/cases/${caseId}`);
  await expect(page).toHaveURL(new RegExp(`/cases/${caseId}$`));
}
