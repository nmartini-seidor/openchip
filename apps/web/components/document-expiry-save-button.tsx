"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

interface DocumentExpirySaveButtonProps {
  formId: string;
  label: string;
  pendingLabel: string;
  className?: string;
}

function DocumentExpirySaveButtonInner({ formId, label, pendingLabel, className }: DocumentExpirySaveButtonProps) {
  const { pending } = useFormStatus();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    const expiryInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[data-expiry-input="1"][form="${formId}"]`)
    );
    if (!(form instanceof HTMLFormElement) || expiryInputs.length === 0) {
      setHasChanges(false);
      return;
    }

    const evaluateChanges = (): void => {
      const changed = expiryInputs.some((input) => {
        const initial = input.dataset.initialValue ?? "";
        return input.value !== initial;
      });
      setHasChanges(changed);
    };

    evaluateChanges();
    for (const input of expiryInputs) {
      input.addEventListener("input", evaluateChanges);
      input.addEventListener("change", evaluateChanges);
    }

    return () => {
      for (const input of expiryInputs) {
        input.removeEventListener("input", evaluateChanges);
        input.removeEventListener("change", evaluateChanges);
      }
    };
  }, [formId]);

  return (
    <button
      type="submit"
      disabled={pending || !hasChanges}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function DocumentExpirySaveButton(props: DocumentExpirySaveButtonProps) {
  return <DocumentExpirySaveButtonInner {...props} />;
}
