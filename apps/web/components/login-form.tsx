"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { SupportedLocale } from "@openchip/shared";

interface LoginCopy {
  title: string;
  subtitle: string;
  email: string;
  language: string;
  signIn: string;
  locale: {
    english: string;
    spanish: string;
  };
  errors: {
    invalidEmail: string;
    userNotFound: string;
  };
}

interface LoginFormProps {
  initialLocale: SupportedLocale;
  nextPath: string;
  errorCode: string | undefined;
  messages: Record<SupportedLocale, LoginCopy>;
}

export function LoginForm({ initialLocale, nextPath, errorCode, messages }: LoginFormProps) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const dict = messages[locale];

  const errorMessage = useMemo(() => {
    if (errorCode === "invalid_email") {
      return dict.errors.invalidEmail;
    }

    if (errorCode === "user_not_found") {
      return dict.errors.userNotFound;
    }

    return null;
  }, [dict.errors.invalidEmail, dict.errors.userNotFound, errorCode]);

  return (
    <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-5 flex justify-center">
        <Image src="/logo-openchip.svg" alt="Openchip" width={220} height={68} className="h-12 w-auto" priority />
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{dict.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{dict.subtitle}</p>

      <form method="post" action="/api/auth/login" className="mt-5 grid gap-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="grid gap-2">
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            {dict.email}
          </label>
          <input
            id="email"
            name="email"
            required
            type="email"
            autoComplete="email"
            placeholder="finance@openchip.local"
            className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="locale" className="text-sm font-semibold text-slate-700">
            {dict.language}
          </label>
          <select
            id="locale"
            name="locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value === "es" ? "es" : "en")}
            className="oc-select h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
          >
            <option value="en">{dict.locale.english}</option>
            <option value="es">{dict.locale.spanish}</option>
          </select>
        </div>

        {errorMessage !== null ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-[var(--danger)]">{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
        >
          {dict.signIn}
        </button>
      </form>
    </section>
  );
}
