"use client";

import { useMemo, useState } from "react";
import Select, { SingleValue } from "react-select";
import { CountryOption } from "@/lib/countries";

interface FilterableCountrySelectProps {
  id: string;
  name: string;
  label: string;
  options: CountryOption[];
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
}

export function FilterableCountrySelect({
  id,
  name,
  label,
  options,
  placeholder,
  defaultValue,
  required = false
}: FilterableCountrySelectProps) {
  const defaultOption = useMemo(
    () => (defaultValue === undefined ? null : options.find((option) => option.value === defaultValue) ?? null),
    [defaultValue, options]
  );
  const [selectedOption, setSelectedOption] = useState<CountryOption | null>(defaultOption);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <Select<CountryOption, false>
        inputId={id}
        instanceId={id}
        options={options}
        value={selectedOption}
        onChange={(option: SingleValue<CountryOption>) => {
          setSelectedOption(option ?? null);
        }}
        placeholder={placeholder}
        isSearchable
        className="text-sm"
        classNamePrefix="oc-country-select"
        styles={{
          control: (base, state) => ({
            ...base,
            minHeight: 40,
            borderColor: state.isFocused ? "var(--primary)" : "var(--border)",
            boxShadow: state.isFocused ? "0 0 0 2px color-mix(in srgb, var(--primary) 20%, transparent)" : "none",
            borderRadius: 8,
            backgroundColor: "var(--surface)",
            "&:hover": {
              borderColor: "var(--border-strong)"
            }
          }),
          valueContainer: (base) => ({
            ...base,
            paddingTop: 2,
            paddingBottom: 2
          }),
          indicatorSeparator: (base) => ({
            ...base,
            display: "none"
          }),
          dropdownIndicator: (base) => ({
            ...base,
            paddingLeft: 6,
            paddingRight: 10
          })
        }}
      />
      <input type="hidden" name={name} value={selectedOption?.value ?? ""} required={required} />
    </div>
  );
}
