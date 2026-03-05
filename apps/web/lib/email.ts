import { createEmailAdapter, EmailAdapter } from "@openchip/integrations";

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

    globalThis.__openchipEmailAdapter = createEmailAdapter({
      fromAddress: process.env.SMTP_FROM ?? "onboarding@openchip.local",
      ...(smtpHost !== undefined ? { smtpHost } : {}),
      ...(smtpPort !== undefined ? { smtpPort } : {})
    });
  }

  return globalThis.__openchipEmailAdapter;
}
