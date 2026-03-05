import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(sessionCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
