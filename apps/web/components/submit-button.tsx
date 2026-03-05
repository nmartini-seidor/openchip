"use client";

import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

interface SubmitButtonProps {
  label: ReactNode;
  pendingLabel?: string;
  className: string;
}

export function SubmitButton({ label, pendingLabel = "Processing…", className }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-live="polite" className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
