import { expect, test, type Page } from "@playwright/test";
import { createCaseViaUi, createUniqueVat, loginAsAdmin, resetTestState, sendInvitationFromCase } from "./utils/scenario";

async function fetchOtpCode(page: Page, supplierUrl: string): Promise<string> {
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

  throw new Error("OTP code was not available within timeout.");
}

async function ensureRequirementExpanded(page: Page, code: string): Promise<void> {
  const section = page.locator("aside section").filter({ hasText: code }).first();
  const uploadInput = section.locator('input[type="file"]');
  if ((await uploadInput.count()) === 0) {
    await section.locator("button").first().click();
  }
}

test("supplier portal exposes templates when configured and shows autosave state", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsAdmin(page);

  await page.goto("/portal-settings?tab=documents");
  const fin01Row = page.locator("tr", { has: page.getByText("FIN-01", { exact: true }) }).first();
  await fin01Row.locator('input[name="templateFile"][type="file"]').setInputFiles([
    {
      name: "fin-01-template.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fin template")
    }
  ]);
  await fin01Row.getByRole("button", { name: /Upload template|Subir plantilla/ }).click();
  await expect(fin01Row.getByRole("link", { name: /Download template|Descargar plantilla/ })).toBeVisible();

  await createCaseViaUi(page, {
    supplierName: "Proveedor Plantillas",
    supplierVat: createUniqueVat("TPL"),
    supplierContactName: "Template Contact",
    supplierContactEmail: "template@example.com",
    requester: "Admin Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await page.goto(supplierUrl);
  if (!/[?&]otp=requested(?:&|$)/.test(page.url())) {
    const sendCodeButton = page.getByRole("button", {
      name: /Send verification code|Enviar código de verificación|Resend verification code|Reenviar código de verificación/
    });
    if ((await sendCodeButton.count()) > 0 && (await sendCodeButton.isEnabled())) {
      await Promise.all([page.waitForURL(/otp=(requested|failed)|otpError=/), sendCodeButton.click()]);
    }
  }

  const otpCode = await fetchOtpCode(page, supplierUrl);
  await page.getByLabel(/Verification code|Código de verificación/).fill(otpCode);
  await Promise.all([
    page.waitForURL(/otp=(verified|failed)|otpError=/),
    page.getByRole("button", { name: /Verify code|Verificar código/ }).click()
  ]);
  await expect(page.getByLabel(/Street|Calle/)).toBeVisible();

  const autosaveIndicator = page.getByTestId("supplier-autosave-indicator");
  await expect(autosaveIndicator).toBeVisible();
  await expect(autosaveIndicator).toContainText(/Autosave enabled|Autoguardado activo/);

  await page.getByLabel(/Street|Calle/).fill("Avinguda Diagonal 222");
  await expect(autosaveIndicator).toContainText(/All changes saved|Todos los cambios guardados/, { timeout: 10_000 });
  await expect(autosaveIndicator).toContainText(/Autosave enabled|Autoguardado activo/, { timeout: 8_000 });

  await ensureRequirementExpanded(page, "FIN-01");
  const fin01Section = page.locator("aside section").filter({ hasText: "FIN-01" }).first();
  const templateLink = fin01Section.getByRole("link", { name: /Download template|Descargar plantilla/ });
  await expect(templateLink).toBeVisible();
  const templateHref = await templateLink.getAttribute("href");
  expect(templateHref).not.toBeNull();
  if (templateHref !== null) {
    const templateResponse = await page.request.get(templateHref);
    expect(templateResponse.ok()).toBeTruthy();
  }

  const fin01UploadInput = fin01Section.locator('input[type="file"]');
  await fin01UploadInput.setInputFiles([
    {
      name: "fin-01-supplier-upload.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 upload")
    }
  ]);
  await expect(fin01Section.getByRole("link", { name: "fin-01-supplier-upload.pdf" })).toBeVisible();
  await expect(autosaveIndicator).toContainText(/All changes saved|Todos los cambios guardados/, { timeout: 10_000 });

  await ensureRequirementExpanded(page, "FIN-02");
  const fin02Section = page.locator("aside section").filter({ hasText: "FIN-02" }).first();
  await expect(fin02Section.getByText(/No template available|No hay plantilla disponible/)).toBeVisible();

  await expect(page.getByRole("button", { name: /Save progress|Guardar progreso/ })).toHaveCount(0);
});
