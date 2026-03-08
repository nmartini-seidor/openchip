"use client";

import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

interface SubmitButtonProps {
  label: ReactNode;
  pendingLabel?: string;
  className: string;
  disabled?: boolean;
}

export function SubmitButton({ label, pendingLabel = "Processing…", className, disabled }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} aria-live="polite" className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
