"use client";

import { useMemo, useState } from "react";

interface VatInputProps {
  label: string;
  inputId: string;
  inputName: string;
}

function looksLikeVat(value: string): boolean {
  const candidate = value.trim().toUpperCase();

  if (candidate.length < 8 || candidate.length > 16) {
    return false;
  }

  return /^[A-Z0-9-]+$/.test(candidate) && /[A-Z]/.test(candidate) && /[0-9]/.test(candidate);
}

export function VatInput({ label, inputId, inputName }: VatInputProps) {
  const [value, setValue] = useState("");
  const [validatedValue, setValidatedValue] = useState<string | null>(null);

  const isValidPattern = useMemo(() => looksLikeVat(value), [value]);
  const isValidated = validatedValue !== null && validatedValue === value.trim().toUpperCase();

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          id={inputId}
          name={inputName}
          required
          autoComplete="off"
          inputMode="text"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setValue(nextValue);
            if (validatedValue !== null && validatedValue !== nextValue.trim().toUpperCase()) {
              setValidatedValue(null);
            }
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-slate-900"
        />
        <button
          type="button"
          disabled={!isValidPattern}
          onClick={() => setValidatedValue(value.trim().toUpperCase())}
          className="inline-flex items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          Validate VAT
        </button>
      </div>
      <p
        className={`text-xs ${isValidated ? "text-[var(--success)]" : "text-slate-500"}`}
        aria-live="polite"
      >
        {isValidated ? "VAT format validated (mock)." : "Validate VAT is enabled when format looks valid."}
      </p>
    </div>
  );
}
