import { expect, test, type Page } from "@playwright/test";
import { createCaseViaUi, createUniqueVat, loginAsFinance, resetTestState, sendInvitationFromCase } from "./utils/scenario";

function extractSupplierToken(supplierUrl: string): string {
  const token = supplierUrl.split("/").filter((segment) => segment.length > 0).at(-1);
  if (token === undefined) {
    throw new Error(`Cannot extract token from supplier url: ${supplierUrl}`);
  }
  return token;
}

async function fetchOtpCode(page: Page, token: string): Promise<string> {
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

async function openSupplierPortalWithOtp(page: Page, supplierUrl: string): Promise<void> {
  await page.goto(supplierUrl);
  if (!/[?&]otp=requested(?:&|$)/.test(page.url())) {
    const sendCodeButton = page.getByRole("button", {
      name: /Send verification code|Enviar código de verificación|Resend verification code|Reenviar código de verificación/
    });
    if ((await sendCodeButton.count()) > 0 && (await sendCodeButton.isEnabled())) {
      await Promise.all([page.waitForURL(/otp=(requested|failed)|otpError=/), sendCodeButton.click()]);
    }
  }

  const token = extractSupplierToken(supplierUrl);
  const otpCode = await fetchOtpCode(page, token);
  await page.getByLabel(/Verification code|Código de verificación/).fill(otpCode);
  await Promise.all([
    page.waitForURL(/otp=(verified|failed)|otpError=/),
    page.getByRole("button", { name: /Verify code|Verificar código/ }).click()
  ]);
  if (page.url().includes("otpError=")) {
    throw new Error(`Supplier OTP verification failed for ${supplierUrl}. Current URL: ${page.url()}`);
  }
  await expect(page.getByLabel(/Street|Calle/)).toBeVisible();
}

test("supplier validates preloaded identity data and confirmation is required", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const initialSupplier = {
    supplierName: "Proveedor Identidad Inicial",
    supplierVat: createUniqueVat("IDENT"),
    supplierContactName: "Contacto Inicial",
    supplierContactEmail: "identity.initial@example.com"
  };
  const updatedSupplier = {
    supplierName: "Proveedor Identidad Confirmada",
    supplierVat: createUniqueVat("IDOK"),
    supplierContactName: "Contacto Confirmado"
  };

  const caseId = await createCaseViaUi(page, {
    supplierName: initialSupplier.supplierName,
    supplierVat: initialSupplier.supplierVat,
    supplierContactName: initialSupplier.supplierContactName,
    supplierContactEmail: initialSupplier.supplierContactEmail,
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await openSupplierPortalWithOtp(page, supplierUrl);

  await expect(page.getByLabel(/Supplier name|Nombre del proveedor/)).toHaveValue(initialSupplier.supplierName);
  await expect(page.getByLabel(/Contact person|Persona de contacto/)).toHaveValue(initialSupplier.supplierContactName);
  await expect(page.getByLabel(/Supplier VAT \/ Tax ID|NIF\/CIF \/ Tax ID del proveedor/)).toHaveValue(initialSupplier.supplierVat);
  await expect(page.getByText(initialSupplier.supplierContactEmail)).toHaveCount(0);

  await page.getByLabel(/Supplier name|Nombre del proveedor/).fill(updatedSupplier.supplierName);
  await page.getByLabel(/Contact person|Persona de contacto/).fill(updatedSupplier.supplierContactName);
  await page.getByLabel(/Supplier VAT \/ Tax ID|NIF\/CIF \/ Tax ID del proveedor/).fill(updatedSupplier.supplierVat);
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
  await expect(page.getByTestId("supplier-autosave-indicator")).toContainText(/All changes saved|Todos los cambios guardados/, {
    timeout: 10_000
  });

  const requirementSections = page.locator("aside section");
  const requirementCount = await requirementSections.count();
  for (let index = 0; index < requirementCount; index += 1) {
    const section = requirementSections.nth(index);
    let uploadInput = section.locator('input[type="file"]');
    if ((await uploadInput.count()) === 0) {
      await section.locator("button").first().click();
      uploadInput = section.locator('input[type="file"]');
    }
    await uploadInput.setInputFiles([
      {
        name: `identity-doc-${index + 1}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 identity validation")
      }
    ]);
  }

  await page.getByRole("button", { name: /Submit Response|Enviar respuesta/i }).click();
  await expect(page).toHaveURL(/error=validation/);
  await expect(page).toHaveURL(/fields=identityConfirmed/);
  await expect(
    page.getByRole("listitem").filter({
      hasText: /I confirm this supplier information is correct|Confirmo que esta información del proveedor es correcta/i
    })
  ).toBeVisible();

  await page
    .getByLabel(/I confirm this supplier information is correct|Confirmo que esta información del proveedor es correcta/i)
    .check();
  await page.getByRole("button", { name: /Submit Response|Enviar respuesta/i }).click();
  await expect(page).toHaveURL(/submitted=1/);

  await page.goto(`/cases/${caseId}`);
  await expect(page.getByRole("heading", { level: 2, name: updatedSupplier.supplierName })).toBeVisible();
  await expect(page.getByText(`VAT: ${updatedSupplier.supplierVat}`)).toBeVisible();
  await expect(page.getByText(updatedSupplier.supplierContactName)).toBeVisible();
});
