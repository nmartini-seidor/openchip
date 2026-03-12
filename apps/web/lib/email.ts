import { createEmailAdapter, EmailAdapter } from "@openchip/integrations";
import { getAppBaseUrl } from "@/lib/app-base-url";

declare global {
  var __openchipEmailAdapter: EmailAdapter | undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

export function getEmailAdapter(): EmailAdapter {
  if (globalThis.__openchipEmailAdapter === undefined) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parsePort(process.env.SMTP_PORT);
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM;
    const preferResend = process.env.VERCEL === "1" || process.env.VERCEL === "true";

    globalThis.__openchipEmailAdapter = createEmailAdapter({
      fromAddress: process.env.SMTP_FROM ?? process.env.RESEND_FROM ?? "onboarding@openchip.local",
      appBaseUrl: getAppBaseUrl(),
      preferResend,
      ...(resendApiKey !== undefined ? { resendApiKey } : {}),
      ...(resendFrom !== undefined ? { resendFrom } : {}),
      ...(smtpHost !== undefined ? { smtpHost } : {}),
      ...(smtpPort !== undefined ? { smtpPort } : {})
    });
  }

  return globalThis.__openchipEmailAdapter;
}
