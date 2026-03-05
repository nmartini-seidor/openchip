import { redirect } from "next/navigation";
import { getCurrentLocale, getSessionUser } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";

function getErrorMessage(errorCode: string | undefined, locale: "en" | "es"): string | null {
  if (errorCode === "invalid_email") {
    return locale === "es" ? "Introduce un correo válido." : "Enter a valid email address.";
  }

  if (errorCode === "user_not_found") {
    return locale === "es"
      ? "Usuario no encontrado o inactivo. Usa un correo inicial como finance@openchip.local."
      : "User not found or inactive. Use a seeded account such as finance@openchip.local.";
  }

  return null;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (sessionUser !== null) {
    redirect("/");
  }

  const locale = await getCurrentLocale();
  const dict = getMessages(locale);
  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error, locale);

  return (
    <main id="main-content" className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center">
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{dict.appName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{dict.loginTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">{dict.loginSubtitle}</p>

        <form method="post" action="/api/auth/login" className="mt-5 grid gap-4">
          <input type="hidden" name="next" value={params.next ?? "/"} />
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
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="locale" className="text-sm font-semibold text-slate-700">
              {dict.language}
            </label>
            <select
              id="locale"
              name="locale"
              defaultValue={locale}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
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
    </main>
  );
}
