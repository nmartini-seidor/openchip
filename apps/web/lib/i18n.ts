import { SupportedLocale, supportedLocales } from "@openchip/shared";

export const defaultLocale: SupportedLocale = "en";

export const localeCookieName = "openchip_locale";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

export function resolveLocale(candidate: string | null | undefined): SupportedLocale {
  if (candidate === undefined || candidate === null || candidate.length === 0) {
    return defaultLocale;
  }

  return isSupportedLocale(candidate) ? candidate : defaultLocale;
}
