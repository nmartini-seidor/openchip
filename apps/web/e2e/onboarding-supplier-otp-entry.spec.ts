import { expect, test, type Page } from "@playwright/test";
import {
  createCaseViaUi,
  createUniqueVat,
  loginAsFinance,
  resetTestState,
  sendInvitationFromCase
} from "./utils/scenario";

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

test("supplier link auto-requests otp and hides supplier details before verification", async ({ page, request }) => {
  await resetTestState(request);
  await loginAsFinance(page);

  const supplierName = "Proveedor OTP Entry";
  await createCaseViaUi(page, {
    supplierName,
    supplierVat: createUniqueVat("OTP"),
    supplierContactName: "OTP Contact",
    supplierContactEmail: "otp-entry@example.com",
    requester: "Finance Team",
    categoryCode: "SUB-STD-NAT"
  });

  const supplierUrl = await sendInvitationFromCase(page);
  await page.goto(supplierUrl);
  await page.waitForURL(/otp=(requested|failed)/);

  await expect(page.getByRole("heading", { name: /Supplier access|Acceso de proveedor/ })).toBeVisible();
  await expect(page.getByText(supplierName, { exact: false })).toHaveCount(0);

  const resendButton = page.getByRole("button", { name: /Resend code in|Reenviar código en/ });
  await expect(resendButton).toBeDisabled();

  const otpCode = await fetchOtpCode(page, supplierUrl);
  await page.getByLabel(/Verification code|Código de verificación/).fill(otpCode);
  await page.getByRole("button", { name: /Verify code|Verificar código/ }).click();
  await expect(page.getByLabel(/Street|Calle/)).toBeVisible();
});
