"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaseStatus } from "@openchip/shared";

type StatusFilter = "all" | CaseStatus;

interface StatusOption {
  value: CaseStatus;
  label: string;
}

interface StatusFilterSelectProps {
  label: string;
  allLabel: string;
  value: StatusFilter;
  options: StatusOption[];
}

export function StatusFilterSelect({ label, allLabel, value, options }: StatusFilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === "all") {
      params.delete("status");
    } else {
      params.set("status", nextValue);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="ml-auto grid gap-1">
      <label htmlFor="statusFilter" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </label>
      <select
        id="statusFilter"
        name="status"
        value={value}
        onChange={(event) => handleChange(event.currentTarget.value)}
        className="oc-input oc-select min-h-8 py-1 text-xs"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
