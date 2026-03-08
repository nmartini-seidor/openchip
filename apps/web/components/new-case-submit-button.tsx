"use client";

import { useFormStatus } from "react-dom";
import { ReactNode, useEffect, useState } from "react";

interface NewCaseSubmitButtonProps {
  formId: string;
  label: ReactNode;
  pendingLabel?: string;
  className: string;
}

function checkFormValid(form: HTMLFormElement): boolean {
  return form.checkValidity();
}

export function NewCaseSubmitButton({ formId, label, pendingLabel = "Processing…", className }: NewCaseSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [canSubmit, setCanSubmit] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const updateValidity = () => {
      setCanSubmit(checkFormValid(form));
    };

    updateValidity();

    form.addEventListener("input", updateValidity);
    form.addEventListener("change", updateValidity);

    return () => {
      form.removeEventListener("input", updateValidity);
      form.removeEventListener("change", updateValidity);
    };
  }, [formId]);

  return (
    <button type="submit" disabled={pending || !canSubmit} aria-live="polite" className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
