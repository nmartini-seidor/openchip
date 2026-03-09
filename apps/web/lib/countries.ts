import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import esLocale from "i18n-iso-countries/langs/es.json";
import { SupportedLocale } from "@openchip/shared";

countries.registerLocale(enLocale);
countries.registerLocale(esLocale);

export interface CountryOption {
  value: string;
  label: string;
}

function localeToCountryLocale(locale: SupportedLocale): "en" | "es" {
  return locale === "es" ? "es" : "en";
}

export function listCountryOptions(locale: SupportedLocale): CountryOption[] {
  const localizedCountries = countries.getNames(localeToCountryLocale(locale), { select: "official" });
  return Object.entries(localizedCountries)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
