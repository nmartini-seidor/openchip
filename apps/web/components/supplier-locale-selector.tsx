"use client";

import { useRef, useState } from "react";
import { SupportedLocale } from "@openchip/shared";

interface SupplierLocaleSelectorProps {
  initialLocale: SupportedLocale;
  label: string;
  englishLabel: string;
  spanishLabel: string;
  returnTo: string;
}

export function SupplierLocaleSelector({
  initialLocale,
  label,
  englishLabel,
  spanishLabel,
  returnTo
}: SupplierLocaleSelectorProps) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form ref={formRef} method="post" action="/api/preferences/locale" className="grid gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="supplier-locale" className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <select
        id="supplier-locale"
        name="locale"
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value === "es" ? "es" : "en";
          setLocale(nextLocale);
          formRef.current?.requestSubmit();
        }}
        className="oc-input oc-select"
      >
        <option value="en">{englishLabel}</option>
        <option value="es">{spanishLabel}</option>
      </select>
    </form>
  );
}
