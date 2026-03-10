import nodemailer from "nodemailer";

export interface SentEmailRecord {
  id: string;
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
  channel: "smtp" | "in_memory";
}

export interface InvitationEmailInput {
  to: string;
  supplierName: string;
  invitationLink: string;
  expiresAt: string;
}

export interface ExpiryReminderEmailInput {
  to: string;
  supplierName: string;
  documentCodes: string[];
}

export interface SupplierOtpEmailInput {
  to: string;
  supplierName: string;
  otpCode: string;
  expiresAt: string;
}

export interface DocumentRejectedEmailInput {
  to: string;
  supplierName: string;
  invitationLink: string;
  documentCodes: string[];
}

export interface EmailAdapter {
  sendInvitationEmail(input: InvitationEmailInput): Promise<SentEmailRecord>;
  sendExpiryReminderEmail(input: ExpiryReminderEmailInput): Promise<SentEmailRecord>;
  sendSupplierOtpEmail(input: SupplierOtpEmailInput): Promise<SentEmailRecord>;
  sendDocumentRejectedEmail(input: DocumentRejectedEmailInput): Promise<SentEmailRecord>;
  listSentEmails(): Promise<SentEmailRecord[]>;
  clearSentEmails(): Promise<void>;
}

export interface EmailAdapterConfig {
  fromAddress: string;
  smtpHost?: string;
  smtpPort?: number;
  appBaseUrl?: string;
}

interface EmailStore {
  emails: SentEmailRecord[];
}

declare global {
  // eslint-disable-next-line no-var
  var __openchipEmailStore: EmailStore | undefined;
}

function getEmailStore(): EmailStore {
  if (globalThis.__openchipEmailStore === undefined) {
    globalThis.__openchipEmailStore = { emails: [] };
  }

  return globalThis.__openchipEmailStore;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBaseUrl(value: string | undefined): string {
  const fallback = "http://localhost:3000";
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface BrandedEmailTemplateInput {
  appBaseUrl: string;
  preheader: string;
  title: string;
  lead: string;
  bodyHtml: string;
}

function renderBrandedEmail(input: BrandedEmailTemplateInput): string {
  const logoUrl = `${input.appBaseUrl}/logo-openchip.svg`;
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(input.title)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f6fb;font-family:'Avenir Next','Trebuchet MS','Gill Sans',Arial,sans-serif;color:#1e293b;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${escapeHtml(input.preheader)}
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f6fb;padding:20px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="620" style="width:620px;max-width:92%;background:#ffffff;border:1px solid #d9e2ef;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 28px;background:linear-gradient(120deg,#0f172a,#1d4ed8);">
                    <img src="${logoUrl}" alt="Openchip" width="140" style="display:block;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:26px 28px 8px 28px;">
                    <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(input.title)}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(input.lead)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 28px 26px 28px;font-size:14px;line-height:1.7;color:#334155;">
                    ${input.bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px;background:#eef3fb;border-top:1px solid #d9e2ef;font-size:12px;line-height:1.6;color:#475569;">
                    Openchip Supplier Onboarding Portal
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function buildInvitationContent(
  input: InvitationEmailInput,
  appBaseUrl: string
): { subject: string; text: string; html: string } {
  const subject = `Openchip supplier onboarding invitation - ${input.supplierName}`;
  const text = [
    `Hello,`,
    ``,
    `You have been invited to complete supplier onboarding for ${input.supplierName}.`,
    `Invitation link: ${input.invitationLink}`,
    `Expires at: ${input.expiresAt}`,
    ``,
    `Openchip Onboarding Team`
  ].join("\n");

  const html = renderBrandedEmail({
    appBaseUrl,
    preheader: `Onboarding invitation for ${input.supplierName}`,
    title: "Supplier onboarding invitation",
    lead: `You have been invited to complete supplier onboarding for ${input.supplierName}.`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello,</p>
      <p style="margin:0 0 18px 0;">Please use the secure link below to access the supplier onboarding portal.</p>
      <p style="margin:0 0 18px 0;">
        <a href="${escapeHtml(input.invitationLink)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;">
          Open supplier onboarding portal
        </a>
      </p>
      <p style="margin:0 0 8px 0;"><strong>Supplier:</strong> ${escapeHtml(input.supplierName)}</p>
      <p style="margin:0 0 14px 0;"><strong>Expires at:</strong> ${escapeHtml(input.expiresAt)}</p>
      <p style="margin:0;color:#475569;">Openchip Onboarding Team</p>
    `
  });

  return { subject, text, html };
}

function buildReminderContent(
  input: ExpiryReminderEmailInput,
  appBaseUrl: string
): { subject: string; text: string; html: string } {
  const codes = input.documentCodes.join(", ");
  const subject = `Openchip document expiry reminder - ${input.supplierName}`;
  const text = [
    `Hello,`,
    ``,
    `The following mandatory supplier documents require update/revalidation:`,
    `${codes}`,
    ``,
    `Please upload updated documents in the supplier portal.`,
    ``,
    `Openchip Onboarding Team`
  ].join("\n");

  const html = renderBrandedEmail({
    appBaseUrl,
    preheader: `Document expiry reminder for ${input.supplierName}`,
    title: "Document expiry reminder",
    lead: `Some mandatory documents for ${input.supplierName} need to be updated.`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello,</p>
      <p style="margin:0 0 10px 0;">The following mandatory supplier documents require update/revalidation:</p>
      <p style="margin:0 0 14px 0;padding:10px 12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;"><strong>${escapeHtml(codes)}</strong></p>
      <p style="margin:0 0 14px 0;">Please upload updated documents in the supplier portal.</p>
      <p style="margin:0;color:#475569;">Openchip Onboarding Team</p>
    `
  });

  return { subject, text, html };
}

function buildSupplierOtpContent(
  input: SupplierOtpEmailInput,
  appBaseUrl: string
): { subject: string; text: string; html: string } {
  const subject = `Openchip supplier access code - ${input.supplierName}`;
  const text = [
    `Hello,`,
    ``,
    `Your verification code for ${input.supplierName} supplier onboarding is: ${input.otpCode}`,
    `This code expires at: ${input.expiresAt}`,
    ``,
    `Openchip Onboarding Team`
  ].join("\n");

  const html = renderBrandedEmail({
    appBaseUrl,
    preheader: `Your Openchip verification code for ${input.supplierName}`,
    title: "Supplier access verification code",
    lead: `Use this one-time code to continue onboarding for ${input.supplierName}.`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello,</p>
      <p style="margin:0 0 10px 0;">Your verification code is:</p>
      <p style="margin:0 0 14px 0;font-size:26px;font-weight:800;letter-spacing:0.18em;color:#0f172a;background:#e2e8f0;border-radius:10px;padding:12px 14px;text-align:center;">
        ${escapeHtml(input.otpCode)}
      </p>
      <p style="margin:0 0 14px 0;"><strong>This code expires at:</strong> ${escapeHtml(input.expiresAt)}</p>
      <p style="margin:0;color:#475569;">Openchip Onboarding Team</p>
    `
  });

  return { subject, text, html };
}

function buildDocumentRejectedContent(
  input: DocumentRejectedEmailInput,
  appBaseUrl: string
): { subject: string; text: string; html: string } {
  const codes = input.documentCodes.join(", ");
  const subject = `Openchip correction required - ${input.supplierName}`;
  const text = [
    `Hello,`,
    ``,
    `Some documents for ${input.supplierName} were rejected and require a new upload:`,
    `${codes}`,
    ``,
    `Supplier portal link: ${input.invitationLink}`,
    ``,
    `Openchip Onboarding Team`
  ].join("\n");

  const html = renderBrandedEmail({
    appBaseUrl,
    preheader: `Correction requested for ${input.supplierName}`,
    title: "Document correction requested",
    lead: `Some uploaded documents for ${input.supplierName} were rejected and require correction.`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello,</p>
      <p style="margin:0 0 10px 0;">Please review and upload a corrected version for:</p>
      <p style="margin:0 0 14px 0;padding:10px 12px;border:1px solid #fecaca;background:#fff1f2;border-radius:10px;"><strong>${escapeHtml(codes)}</strong></p>
      <p style="margin:0 0 18px 0;">
        <a href="${escapeHtml(input.invitationLink)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700;">
          Open supplier onboarding portal
        </a>
      </p>
      <p style="margin:0;color:#475569;">Openchip Onboarding Team</p>
    `
  });

  return { subject, text, html };
}

export function createEmailAdapter(config: EmailAdapterConfig): EmailAdapter {
  const store = getEmailStore();
  const appBaseUrl = normalizeBaseUrl(config.appBaseUrl);

  const smtpEnabled = config.smtpHost !== undefined && config.smtpPort !== undefined;

  const transporter = smtpEnabled
    ? nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: false,
        tls: { rejectUnauthorized: false }
      })
    : null;

  async function deliver(to: string, subject: string, text: string, html: string): Promise<SentEmailRecord> {
    const channel: SentEmailRecord["channel"] = smtpEnabled ? "smtp" : "in_memory";

    if (transporter !== null) {
      await transporter.sendMail({
        from: config.fromAddress,
        to,
        subject,
        text,
        html
      });
    }

    const record: SentEmailRecord = {
      id: randomId(),
      to,
      from: config.fromAddress,
      subject,
      text,
      html,
      createdAt: nowIso(),
      channel
    };

    store.emails.unshift(record);
    return record;
  }

  return {
    async sendInvitationEmail(input) {
      const content = buildInvitationContent(input, appBaseUrl);
      return deliver(input.to, content.subject, content.text, content.html);
    },
    async sendExpiryReminderEmail(input) {
      const content = buildReminderContent(input, appBaseUrl);
      return deliver(input.to, content.subject, content.text, content.html);
    },
    async sendSupplierOtpEmail(input) {
      const content = buildSupplierOtpContent(input, appBaseUrl);
      return deliver(input.to, content.subject, content.text, content.html);
    },
    async sendDocumentRejectedEmail(input) {
      const content = buildDocumentRejectedContent(input, appBaseUrl);
      return deliver(input.to, content.subject, content.text, content.html);
    },
    async listSentEmails() {
      return store.emails.map((email) => ({ ...email }));
    },
    async clearSentEmails() {
      store.emails.splice(0, store.emails.length);
    }
  };
}
