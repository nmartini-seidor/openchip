import { APIRequestContext, expect } from "@playwright/test";

interface OutboxEmail {
  id: string;
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  createdAt: string;
  channel: "smtp" | "in_memory";
}

interface OutboxResponse {
  emails: OutboxEmail[];
}

interface MailpitAddress {
  Address: string;
  Name: string;
}

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
}

interface MailpitMessagesResponse {
  messages: MailpitMessageSummary[];
}

interface MailpitMessage {
  Subject: string;
  Text: string;
  HTML: string;
}

export interface ObservedEmail {
  recipient: string;
  subject: string;
  text: string;
  html: string;
  source: "mailpit" | "outbox";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchFromOutbox(request: APIRequestContext, recipient: string, subjectContains: string): Promise<ObservedEmail | null> {
  const response = await request.get("/api/test/outbox");
  if (!response.ok()) {
    return null;
  }

  const payload = (await response.json()) as OutboxResponse;
  const email = payload.emails.find(
    (candidate) =>
      candidate.to.toLowerCase() === recipient.toLowerCase() &&
      candidate.subject.toLowerCase().includes(subjectContains.toLowerCase())
  );

  if (email === undefined) {
    return null;
  }

  return {
    recipient: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    source: "outbox"
  };
}

async function fetchFromMailpit(
  mailpitApiBaseUrl: string,
  recipient: string,
  subjectContains: string
): Promise<ObservedEmail | null> {
  const baseUrl = mailpitApiBaseUrl.replace(/\/$/, "");
  const summaryResponse = await fetch(`${baseUrl}/api/v1/messages?limit=50`, { cache: "no-store" });

  if (!summaryResponse.ok) {
    return null;
  }

  const summary = (await summaryResponse.json()) as MailpitMessagesResponse;
  const match = summary.messages.find((message) => {
    const matchesRecipient = message.To.some((address) => address.Address.toLowerCase() === recipient.toLowerCase());
    const matchesSubject = message.Subject.toLowerCase().includes(subjectContains.toLowerCase());
    return matchesRecipient && matchesSubject;
  });

  if (match === undefined) {
    return null;
  }

  const detailsResponse = await fetch(`${baseUrl}/api/v1/message/${match.ID}`, { cache: "no-store" });
  if (!detailsResponse.ok) {
    return null;
  }

  const details = (await detailsResponse.json()) as MailpitMessage;
  return {
    recipient,
    subject: details.Subject,
    text: details.Text,
    html: details.HTML,
    source: "mailpit"
  };
}

export async function waitForEmail(
  request: APIRequestContext,
  recipient: string,
  subjectContains: string,
  timeoutMs = 20_000
): Promise<ObservedEmail> {
  const start = Date.now();
  const mailpitApiBaseUrl = process.env.MAILPIT_API_BASE_URL;

  while (Date.now() - start < timeoutMs) {
    const fromOutbox = await fetchFromOutbox(request, recipient, subjectContains);
    if (fromOutbox !== null) {
      return fromOutbox;
    }

    if (mailpitApiBaseUrl !== undefined && mailpitApiBaseUrl.length > 0) {
      const fromMailpit = await fetchFromMailpit(mailpitApiBaseUrl, recipient, subjectContains);
      if (fromMailpit !== null) {
        return fromMailpit;
      }
    }

    await sleep(350);
  }

  throw new Error(
    `Expected email not found for recipient=${recipient}, subject~=${subjectContains}, timeoutMs=${timeoutMs}`
  );
}

export async function assertEmailContains(
  request: APIRequestContext,
  recipient: string,
  subjectContains: string,
  bodyContains: string
): Promise<void> {
  const email = await waitForEmail(request, recipient, subjectContains);
  const body = `${email.text}\n${email.html}`.toLowerCase();
  expect(body.includes(bodyContains.toLowerCase())).toBeTruthy();
}
