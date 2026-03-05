import { NextResponse } from "next/server";
import { loginInputSchema } from "@openchip/shared";
import { createSessionCookieValue, getDefaultLocale, sessionCookieName } from "@/lib/auth";
import { localeCookieName, resolveLocale } from "@/lib/i18n";
import { onboardingRepository } from "@/lib/repository";

function readFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function safeRedirectPath(candidate: string | undefined): string {
  if (candidate === undefined || candidate.length === 0) {
    return "/";
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/";
  }

  return candidate;
}

export async function POST(request: Request): Promise<NextResponse> {
  const formData = await request.formData();
  const nextPath = safeRedirectPath(readFormString(formData, "next"));

  const parsed = loginInputSchema.safeParse({
    email: readFormString(formData, "email"),
    locale: readFormString(formData, "locale")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?error=invalid_email", request.url));
  }

  const user = await onboardingRepository.getUserByEmail(parsed.data.email);
  if (user === null || !user.active) {
    return NextResponse.redirect(new URL("/login?error=user_not_found", request.url));
  }

  const locale = resolveLocale(parsed.data.locale ?? getDefaultLocale());
  const response = NextResponse.redirect(new URL(nextPath, request.url));

  response.cookies.set(sessionCookieName, createSessionCookieValue(user.id, locale), {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  response.cookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
