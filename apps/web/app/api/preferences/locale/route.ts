import { NextResponse } from "next/server";
import { localeCookieName, resolveLocale } from "@/lib/i18n";

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
  const locale = resolveLocale(readFormString(formData, "locale"));
  const returnTo = safeRedirectPath(readFormString(formData, "returnTo"));

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(localeCookieName, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
