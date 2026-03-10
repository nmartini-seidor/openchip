"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

interface SupplierSearchFilterProps {
  label: string;
  placeholder: string;
  value: string;
  resetPageParam?: string;
}

export function SupplierSearchFilter({
  label,
  placeholder,
  value,
  resetPageParam = "page"
}: SupplierSearchFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    if (inputRef.current === document.activeElement) {
      return;
    }

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
      params.delete(resetPageParam);

      const next = params.toString();
      router.replace(next.length > 0 ? `${pathname}?${next}` : pathname, { scroll: false });
    }, 180);

    return () => {
      clearTimeout(timeout);
    };
  }, [pathname, query, resetPageParam, router, searchParams]);

  return (
    <div className="grid gap-1 sm:w-72">
      <label htmlFor="supplier-search" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          strokeWidth={1.8}
        />
        <input
          ref={inputRef}
          id="supplier-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={placeholder}
          className="oc-input min-h-8 py-1 pr-8 text-sm"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
