"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface SupplierSearchFilterProps {
  label: string;
  placeholder: string;
  value: string;
}

export function SupplierSearchFilter({ label, placeholder, value }: SupplierSearchFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const currentQuery = (searchParams.get("q") ?? "").trim();
      const nextQuery = query.trim();

      if (currentQuery === nextQuery) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery.length === 0) {
        params.delete("q");
      } else {
        params.set("q", nextQuery);
      }

      const next = params.toString();
      router.replace(next.length > 0 ? `${pathname}?${next}` : pathname);
    }, 180);

    return () => {
      clearTimeout(timeout);
    };
  }, [pathname, query, router, searchParams]);

  return (
    <div className="grid gap-1 sm:w-72">
      <label htmlFor="supplier-search" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13 13 17 17" />
        </svg>
        <input
          id="supplier-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={placeholder}
          className="oc-input min-h-8 py-1 pl-8 text-sm"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
