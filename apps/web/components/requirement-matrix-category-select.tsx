"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface RequirementMatrixCategoryOption {
  code: string;
  label: string;
}

interface RequirementMatrixCategorySelectProps {
  id: string;
  label: string;
  selectedCategoryCode: string;
  options: RequirementMatrixCategoryOption[];
}

export function RequirementMatrixCategorySelect({
  id,
  label,
  selectedCategoryCode,
  options
}: RequirementMatrixCategorySelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(selectedCategoryCode);

  useEffect(() => {
    setValue(selectedCategoryCode);
  }, [selectedCategoryCode]);

  const onChange = (nextValue: string): void => {
    setValue(nextValue);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "matrix");
    params.set("category", nextValue);
    const next = params.toString();
    router.replace(next.length > 0 ? `${pathname}?${next}` : pathname);
  };

  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="oc-input oc-select"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code} - {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
