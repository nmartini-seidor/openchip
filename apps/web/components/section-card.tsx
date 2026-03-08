import { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  headerAction,
  children
}: {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
      <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle !== undefined ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {headerAction !== undefined ? <div className="mt-2 sm:mt-0 sm:shrink-0">{headerAction}</div> : null}
      </header>
      {children}
    </section>
  );
}
