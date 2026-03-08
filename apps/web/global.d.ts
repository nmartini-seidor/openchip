import { SupportedLocale } from "@openchip/shared";
import enMessages from "@/messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: SupportedLocale;
    Messages: typeof enMessages;
  }
}
