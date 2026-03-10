"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ReactNode } from "react";

interface RequirementMatrixSaveButtonProps {
  formId: string;
  label: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
}

function RequirementMatrixSaveButtonInner({
  formId,
  label,
  pendingLabel,
  className
}: RequirementMatrixSaveButtonProps) {
  const { pending } = useFormStatus();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) {
      setHasChanges(false);
      return;
    }
    const trackedInputs = [
      ...Array.from(form.querySelectorAll<HTMLSelectElement>('select[data-matrix-input="1"]')),
      ...Array.from(document.querySelectorAll<HTMLSelectElement>(`select[data-matrix-input="1"][form="${formId}"]`))
    ];
    if (trackedInputs.length === 0) {
      setHasChanges(false);
      return;
    }

    const evaluateChanges = (): void => {
      const changed = trackedInputs.some((input) => {
        const initial = input.dataset.initialValue ?? "";
        return input.value !== initial;
      });
      setHasChanges(changed);
    };

    evaluateChanges();
    for (const input of trackedInputs) {
      input.addEventListener("change", evaluateChanges);
      input.addEventListener("input", evaluateChanges);
    }

    return () => {
      for (const input of trackedInputs) {
        input.removeEventListener("change", evaluateChanges);
        input.removeEventListener("input", evaluateChanges);
      }
    };
  }, [formId]);

  return (
    <button type="submit" disabled={pending || !hasChanges} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function RequirementMatrixSaveButton(props: RequirementMatrixSaveButtonProps) {
  return <RequirementMatrixSaveButtonInner {...props} />;
}
