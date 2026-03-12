function normalizeBaseUrl(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string {
  const explicit = normalizeBaseUrl(process.env.APP_BASE_URL);
  if (explicit !== null) {
    return explicit;
  }

  const vercelProduction = normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProduction !== null) {
    return vercelProduction;
  }

  const vercelDeployment = normalizeBaseUrl(process.env.VERCEL_URL);
  if (vercelDeployment !== null) {
    return vercelDeployment;
  }

  return "http://localhost:3000";
}
