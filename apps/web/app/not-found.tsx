import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-[70vh] w-full items-center justify-center">
      <section className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[0_8px_20px_-16px_rgba(15,23,42,0.35)]">
        <h2 className="text-2xl font-bold text-slate-900">Resource not found</h2>
        <p className="mt-3 text-sm text-slate-600">
          The supplier case or invitation link is invalid, expired, or no longer available.
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-strong)]"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
