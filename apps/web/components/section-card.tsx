import { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
      <header className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle !== undefined ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
