import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InternalRole, SupportedLocale } from "@openchip/shared";
import { onboardingRepository } from "@/lib/repository";
import { defaultLocale, localeCookieName, resolveLocale } from "@/lib/i18n";

export const sessionCookieName = "openchip_session";

interface SessionPayload {
  userId: string;
  locale: SupportedLocale;
  issuedAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: InternalRole;
  locale: SupportedLocale;
}

function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSession(value: string): SessionPayload | null {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<SessionPayload>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.locale !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      locale: resolveLocale(parsed.locale),
      issuedAt: parsed.issuedAt
    };
  } catch {
    return null;
  }
}

export function actorFromSession(user: SessionUser): string {
  return `${user.displayName} <${user.email}>`;
}

export async function getCurrentLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(localeCookieName)?.value;
  return resolveLocale(raw);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const rawSession = cookieStore.get(sessionCookieName)?.value;
  if (rawSession === undefined) {
    return null;
  }

  const payload = decodeSession(rawSession);
  if (payload === null) {
    return null;
  }

  const user = await onboardingRepository.getUser(payload.userId);
  if (user === null || !user.active) {
    return null;
  }

  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value ?? payload.locale);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    locale
  };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user === null) {
    redirect("/login");
  }

  return user;
}

export async function requireSessionRole(roles: readonly InternalRole[]): Promise<SessionUser> {
  const user = await requireSessionUser();
  if (!roles.includes(user.role)) {
    redirect("/");
  }

  return user;
}

export function createSessionCookieValue(userId: string, locale: SupportedLocale): string {
  return encodeSession({ userId, locale, issuedAt: new Date().toISOString() });
}

export function getDefaultLocale(): SupportedLocale {
  return defaultLocale;
}
