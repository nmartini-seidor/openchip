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
  await page.getByLabel(/Email|Correo/).fill(email);
  await page.getByRole("button", { name: /Sign in|Entrar/ }).click();
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
  await page
    .getByRole("button", { name: /Create onboarding (case|supplier)|Crear proveedor de onboarding/i })
    .click();

  await expect(page).toHaveURL(/\/cases\/[0-9a-fA-F-]{36}$/);
  return extractCaseIdFromUrl(page.url());
}

export async function sendInvitationFromCase(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Send invitation" }).click();
  const supplierLink = page.getByRole("link", { name: /Open supplier portal|Abrir portal del proveedor/ });
  if (await supplierLink.count()) {
    await expect(supplierLink).toBeVisible();
    const href = await supplierLink.getAttribute("href");
    if (href === null) {
      throw new Error("Missing supplier portal link after invitation.");
    }

    return href;
  }

  const copyLinkButton = page.getByRole("button", { name: /Supplier Link|Enlace proveedor/ });
  await expect(copyLinkButton).toBeVisible();
  const href = await copyLinkButton.getAttribute("data-link-value");
  if (href === null) {
    throw new Error("Missing supplier portal value after invitation.");
  }

  return href;
}

async function fetchOtpCodeForSupplier(page: Page, supplierUrl: string): Promise<string> {
  const token = supplierUrl.split("/").filter((segment) => segment.length > 0).at(-1);
  if (token === undefined) {
    throw new Error(`Cannot extract token from supplier url: ${supplierUrl}`);
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await page.request.get(`/api/test/supplier/${token}/otp`);
    if (response.ok()) {
      const payload = (await response.json()) as { code: string | null };
      if (typeof payload.code === "string" && payload.code.length === 6) {
        return payload.code;
      }
    }
    await page.waitForTimeout(200);
  }

  throw new Error(`OTP code was not available for token=${token} within timeout.`);
}

export async function submitSupplierResponse(
  page: Page,
  supplierUrl: string,
  caseId: string,
  _supplierContactEmail: string
): Promise<void> {
  await page.goto(supplierUrl);
  if (!/[?&]otp=requested(?:&|$)/.test(page.url())) {
    const sendCodeButton = page.getByRole("button", {
      name: /Send verification code|Enviar código de verificación|Resend verification code|Reenviar código de verificación/
    });
    if ((await sendCodeButton.count()) > 0 && (await sendCodeButton.isEnabled())) {
      await Promise.all([
        page.waitForURL(/otp=(requested|failed)|otpError=/),
        sendCodeButton.click()
      ]);
    }
  }
  const otpCode = await fetchOtpCodeForSupplier(page, supplierUrl);
  await page.getByLabel(/Verification code|Código de verificación/).fill(otpCode);
  await Promise.all([
    page.waitForURL(/otp=(verified|failed)|otpError=/),
    page.getByRole("button", { name: /Verify code|Verificar código/ }).click()
  ]);
  if (page.url().includes("otpError=")) {
    throw new Error(`Supplier OTP verification failed for ${supplierUrl}. Current URL: ${page.url()}`);
  }
  await expect(page.getByLabel(/Street|Calle/)).toBeVisible();
  await expect(page.getByLabel(/Supplier name|Nombre del proveedor/)).toBeVisible();
  await expect(page.getByLabel(/Contact person|Persona de contacto/)).toBeVisible();
  await expect(page.getByLabel(/Supplier VAT \/ Tax ID|NIF\/CIF \/ Tax ID del proveedor/)).toBeVisible();

  await page.getByLabel(/Street|Calle/).fill("Carrer de Mallorca 123");
  await page.getByLabel(/City|Ciudad/).fill("Barcelona");
  await page.getByLabel(/Postal code|Código postal/).fill("08013");
  await page.locator("#country").click();
  await page.locator("#country").fill("Spain");
  await page.keyboard.press("Enter");

  await page.locator("#banks").click();
  await page.locator("#banks").fill("Spain");
  await page.keyboard.press("Enter");

  await page.getByLabel(/IBAN|número de cuenta bancaria|bank account number/i).fill("ES9121000418450200051332");
  await page.getByLabel(/Bank account holder name|Titular de la cuenta bancaria/).fill("Proveedor Demo SL");
  await page
    .getByLabel(/I confirm this supplier information is correct|Confirmo que esta información del proveedor es correcta/i)
    .check();

  const requirementSections = page.locator("aside section");
  const requirementCount = await requirementSections.count();
  for (let index = 0; index < requirementCount; index += 1) {
    const section = requirementSections.nth(index);
    let uploadInput = section.locator('input[type="file"]');
    if ((await uploadInput.count()) === 0) {
      await section.locator("button").first().click();
      uploadInput = section.locator('input[type="file"]');
    }
    await expect(uploadInput).toBeVisible();
    const fileName = `requirement-${index + 1}.pdf`;
    await uploadInput.setInputFiles([
      {
        name: fileName,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 demo")
      }
    ]);
    await expect(section.getByRole("link", { name: fileName })).toBeVisible();
  }

  await page.getByRole("button", { name: /Submit Response|Enviar respuesta/ }).click();

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
