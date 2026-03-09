import { cookies } from "next/headers";

export const supplierSessionCookieName = "openchip_supplier_session";

interface SupplierSessionPayload {
  token: string;
  caseId: string;
  verifiedAt: string;
  issuedAt: string;
}

function encodeSupplierSession(payload: SupplierSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSupplierSession(value: string): SupplierSessionPayload | null {
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as Partial<SupplierSessionPayload>;

    if (
      typeof parsed.token !== "string" ||
      typeof parsed.caseId !== "string" ||
      typeof parsed.verifiedAt !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }

    return {
      token: parsed.token,
      caseId: parsed.caseId,
      verifiedAt: parsed.verifiedAt,
      issuedAt: parsed.issuedAt
    };
  } catch {
    return null;
  }
}

export async function getSupplierPortalSession(): Promise<SupplierSessionPayload | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(supplierSessionCookieName)?.value;
  if (value === undefined) {
    return null;
  }

  return decodeSupplierSession(value);
}

export async function hasSupplierPortalSession(token: string, caseId: string): Promise<boolean> {
  const session = await getSupplierPortalSession();
  return session !== null && session.token === token && session.caseId === caseId;
}

export async function createSupplierPortalSession(input: {
  token: string;
  caseId: string;
  verifiedAt: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const value = encodeSupplierSession({
    token: input.token,
    caseId: input.caseId,
    verifiedAt: input.verifiedAt,
    issuedAt: new Date().toISOString()
  });

  cookieStore.set(supplierSessionCookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function clearSupplierPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(supplierSessionCookieName);
}
