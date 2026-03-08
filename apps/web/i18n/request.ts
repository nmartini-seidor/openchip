import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { SupportedLocale } from "@openchip/shared";
import { defaultLocale, isSupportedLocale, localeCookieName } from "@/lib/i18n";

const messageLoaders: Record<SupportedLocale, () => Promise<Record<string, unknown>>> = {
  en: async () => (await import("@/messages/en.json")).default,
  es: async () => (await import("@/messages/es.json")).default
};

export default getRequestConfig(async () => {
  const localeCookie = (await cookies()).get(localeCookieName)?.value;
  const locale: SupportedLocale =
    localeCookie !== undefined && isSupportedLocale(localeCookie) ? localeCookie : defaultLocale;

  return {
    locale,
    messages: await messageLoaders[locale]()
  };
});
