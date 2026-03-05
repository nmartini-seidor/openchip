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

export interface EmailAdapter {
  sendInvitationEmail(input: InvitationEmailInput): Promise<SentEmailRecord>;
  sendExpiryReminderEmail(input: ExpiryReminderEmailInput): Promise<SentEmailRecord>;
  listSentEmails(): Promise<SentEmailRecord[]>;
  clearSentEmails(): Promise<void>;
}

export interface EmailAdapterConfig {
  fromAddress: string;
  smtpHost?: string;
  smtpPort?: number;
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

function buildInvitationContent(input: InvitationEmailInput): { subject: string; text: string; html: string } {
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

  const html = `
    <p>Hello,</p>
    <p>You have been invited to complete supplier onboarding for <strong>${input.supplierName}</strong>.</p>
    <p><a href="${input.invitationLink}">Open supplier onboarding portal</a></p>
    <p>Expires at: <strong>${input.expiresAt}</strong></p>
    <p>Openchip Onboarding Team</p>
  `;

  return { subject, text, html };
}

function buildReminderContent(input: ExpiryReminderEmailInput): { subject: string; text: string; html: string } {
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

  const html = `
    <p>Hello,</p>
    <p>The following mandatory supplier documents require update/revalidation:</p>
    <p><strong>${codes}</strong></p>
    <p>Please upload updated documents in the supplier portal.</p>
    <p>Openchip Onboarding Team</p>
  `;

  return { subject, text, html };
}

export function createEmailAdapter(config: EmailAdapterConfig): EmailAdapter {
  const store = getEmailStore();

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
      const content = buildInvitationContent(input);
      return deliver(input.to, content.subject, content.text, content.html);
    },
    async sendExpiryReminderEmail(input) {
      const content = buildReminderContent(input);
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
