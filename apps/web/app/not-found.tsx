import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main id="main-content" className="flex min-h-[70vh] w-full items-center justify-center">
      <section className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-bold text-slate-900">{t("title")}</h2>
        <p className="mt-3 text-sm text-slate-600">{t("description")}</p>
        <div className="mt-5">
          <Link
            href="/"
            className="oc-btn oc-btn-primary"
          >
            {t("back")}
          </Link>
        </div>
      </section>
    </main>
  );
}
